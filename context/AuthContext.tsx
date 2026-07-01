import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';
import { getRoleProfile, resolveUserRole } from '../lib/roleUtils';
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
    const role = resolveUserRole(user, profile);
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
            .maybeSingle();

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

        // Get initial session
        supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
            setSession(currentSession);
            const authUser = currentSession?.user ?? null;
            setUser(authUser);
            await loadUserProfile(authUser);
            setLoading(false);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, newSession) => {
                setLoading(true);
                setSession(newSession);
                const authUser = newSession?.user ?? null;
                setUser(authUser);
                await loadUserProfile(authUser);
                setLoading(false);
            }
        );

        return () => {
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
