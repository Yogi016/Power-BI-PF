import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import { getRoleProfile, resolveUserRole } from '../lib/roleUtils';
import { getDevRoleOverride } from '../lib/devRoleOverride';
import type { RoleProfile, UserProfile, UserRole } from '../types';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    role: UserRole;
    roleProfile: RoleProfile;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const role = getDevRoleOverride() ?? resolveUserRole(user, profile);
    const roleProfile = getRoleProfile(role);

    const loadUserProfile = useCallback(async (authUser: User | null) => {
        if (!supabase || !authUser) {
            setProfile(null);
            return;
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, role_code, assigned_project_ids, is_active, created_at, updated_at')
            .eq('user_id', authUser.id)
            .maybeSingle()
            .abortSignal(AbortSignal.timeout(2_000));

        if (error) {
            console.warn('User profile unavailable, falling back to auth metadata:', error);
            setProfile(null);
            return;
        }

        if (!data) {
            setProfile(null);
            return;
        }

        setProfile({
            userId: data.user_id,
            fullName: data.full_name,
            roleCode: data.role_code as UserRole,
            assignedProjectIds: data.assigned_project_ids || [],
            isActive: Boolean(data.is_active),
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        });
    }, []);

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        let resolved = false;
        // Tracks the currently signed-in identity so we can skip redundant
        // user_profiles fetches on events that don't change who is logged in.
        let lastUserId: string | null = null;

        // Hard ceiling: if the entire init chain (getSession + loadUserProfile)
        // hasn't finished in 3 seconds, stop waiting and show the app.
        const initTimeout = setTimeout(() => {
            if (cancelled || resolved) return;
            resolved = true;
            console.warn('Auth init timed out after 3s, proceeding without session');
            setLoading(false);
        }, 3_000);

        supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
            if (cancelled || resolved) return;
            setSession(currentSession);
            const authUser = currentSession?.user ?? null;
            setUser(authUser);
            lastUserId = authUser?.id ?? null;
            try {
                await loadUserProfile(authUser);
            } catch (err) {
                console.warn('Failed to load user profile during init:', err);
            }
            if (cancelled || resolved) return;
            resolved = true;
            clearTimeout(initTimeout);
            setLoading(false);
        }).catch((err) => {
            if (cancelled || resolved) return;
            resolved = true;
            clearTimeout(initTimeout);
            console.warn('Failed to get initial session:', err);
            setLoading(false);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                // Only show loading screen for actual sign-out (clears the UI).
                // Sign-in loading is handled by LoginPage itself.
                // Token refresh and other events should update silently
                // to avoid flashing the loading screen.
                if (event === 'SIGNED_OUT') {
                    setLoading(true);
                }

                setSession(newSession);
                const authUser = newSession?.user ?? null;
                setUser(authUser);

                // The initial session is already handled by the getSession()
                // chain above, and TOKEN_REFRESHED fires periodically without
                // changing who is signed in. Re-running the user_profiles query
                // on those events is redundant, so only reload the profile when
                // the signed-in identity actually changes.
                const identityChanged = lastUserId !== (authUser?.id ?? null);
                lastUserId = authUser?.id ?? null;
                const skipProfileReload =
                    !identityChanged &&
                    (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED');

                if (!skipProfileReload) {
                    try {
                        await loadUserProfile(authUser);
                    } catch (err) {
                        console.warn('Failed to load user profile on auth change:', err);
                    }
                }

                if (event === 'SIGNED_OUT') {
                    setLoading(false);
                }
            }
        );

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, [loadUserProfile]);

    const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
        if (!supabase) {
            return { error: 'Supabase belum terhubung' };
        }

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                if (error.message === 'Invalid login credentials') {
                    return { error: 'Email atau password salah' };
                }
                return { error: error.message };
            }

            return { error: null };
        } catch {
            return { error: 'Terjadi kesalahan jaringan' };
        }
    }, []);

    const signOut = useCallback(async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
    }, []);

    return (
        <AuthContext.Provider value={{ user, session, profile, role, roleProfile, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
