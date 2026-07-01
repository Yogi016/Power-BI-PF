-- Penegakan role untuk transisi status PKS/MOU (#1)

-- a. Role pemanggil saat ini
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role_code FROM public.user_profiles
         WHERE user_id = auth.uid() AND is_active = true
         LIMIT 1),
        'staff_officer'
    );
$$;

-- b. Matriks transisi (identik dengan COOPERATION_TRANSITIONS di lib/cooperationWorkflow.ts)
CREATE OR REPLACE FUNCTION public.is_valid_cooperation_transition(
    p_from TEXT, p_to TEXT, p_role TEXT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT (p_from, p_to, p_role) IN (
        ('draft-internal',            'review-project-head',       'staff_officer'),
        ('review-legal-internal',     'review-mitra',              'staff_officer'),
        ('review-mitra',              'revisi-final',              'staff_officer'),
        ('revisi-final',              'validasi-project-manager',  'staff_officer'),
        ('disetujui-vp',              'siap-ttd',                  'staff_officer'),
        ('siap-ttd',                  'proses-ttd',                'staff_officer'),
        ('proses-ttd',                'aktif',                     'staff_officer'),
        ('aktif',                     'monitoring-implementasi',   'staff_officer'),
        ('monitoring-implementasi',   'selesai',                   'staff_officer'),
        ('monitoring-implementasi',   'diperpanjang',              'staff_officer'),
        ('monitoring-implementasi',   'diarsipkan',                'staff_officer'),
        ('review-project-head',       'review-legal-internal',     'project_head'),
        ('review-project-head',       'revisi-final',              'project_head'),
        ('validasi-project-manager',  'menunggu-approval-vp',      'project_manager'),
        ('validasi-project-manager',  'revisi-final',              'project_manager'),
        ('monitoring-implementasi',   'selesai',                   'project_manager'),
        ('monitoring-implementasi',   'diperpanjang',              'project_manager'),
        ('monitoring-implementasi',   'diarsipkan',                'project_manager'),
        ('menunggu-approval-vp',      'disetujui-vp',              'vp_lingkungan'),
        ('menunggu-approval-vp',      'revisi-final',              'vp_lingkungan')
    );
$$;

-- c. Trigger penjaga: blokir perubahan status yang tak sesuai matriks
CREATE OR REPLACE FUNCTION public.enforce_cooperation_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT public.is_valid_cooperation_transition(OLD.status, NEW.status, public.current_app_role()) THEN
            RAISE EXCEPTION 'Role % tidak berhak mengubah status dari % ke %',
                public.current_app_role(), OLD.status, NEW.status
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cooperation_transition ON cooperation_documents;
CREATE TRIGGER trg_enforce_cooperation_transition
    BEFORE UPDATE ON cooperation_documents
    FOR EACH ROW EXECUTE FUNCTION public.enforce_cooperation_transition();

-- d. RPC entry point: transisi + tulis approval + audit dalam 1 transaksi
CREATE OR REPLACE FUNCTION public.advance_cooperation_status(
    p_document_id UUID,
    p_to_status TEXT,
    p_notes TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from TEXT;
    v_role TEXT := public.current_app_role();
    v_action TEXT;
BEGIN
    SELECT status INTO v_from FROM cooperation_documents WHERE id = p_document_id FOR UPDATE;
    IF v_from IS NULL THEN
        RAISE EXCEPTION 'Dokumen tidak ditemukan';
    END IF;

    -- UPDATE memicu trigger penjaga; transisi tak valid membatalkan seluruh transaksi.
    UPDATE cooperation_documents
       SET status = p_to_status, updated_at = NOW()
     WHERE id = p_document_id;

    v_action := CASE
        WHEN p_to_status = 'revisi-final'
             AND v_from IN ('review-project-head','validasi-project-manager','menunggu-approval-vp')
            THEN 'requested_revision'
        ELSE 'approved'
    END;

    INSERT INTO cooperation_document_approvals
        (document_id, approver_role, approver_user_id, action, comment, from_status, to_status)
        VALUES (p_document_id, v_role, auth.uid(), v_action, p_notes, v_from, p_to_status);

    INSERT INTO audit_events
        (entity_type, entity_id, actor_user_id, actor_role, action, from_value, to_value, notes)
        VALUES ('cooperation_document', p_document_id, auth.uid(), v_role,
                'status_transition', to_jsonb(v_from), to_jsonb(p_to_status), p_notes);

    RETURN p_to_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_cooperation_status(UUID, TEXT, TEXT) TO authenticated;
