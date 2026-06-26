-- 1) Ensure request numbers are generated server-side (only when missing/blank)
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INTEGER;
BEGIN
    IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
      year_prefix := 'DEM-' || to_char(now(), 'YYYY') || '-';

      SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 10) AS INTEGER)), 0) + 1
      INTO sequence_num
      FROM public.part_requests
      WHERE request_number LIKE year_prefix || '%';

      NEW.request_number := year_prefix || LPAD(sequence_num::TEXT, 4, '0');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_part_requests_generate_number ON public.part_requests;
CREATE TRIGGER trg_part_requests_generate_number
BEFORE INSERT ON public.part_requests
FOR EACH ROW
EXECUTE FUNCTION public.generate_request_number();


-- 2) Enforce conformity ONLY when a request is decided (pending -> approved/rejected)
CREATE OR REPLACE FUNCTION public.enforce_request_conformity_on_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('approved'::public.request_status, 'rejected'::public.request_status)
     AND NEW.conformity IS NULL THEN
    RAISE EXCEPTION 'conformity_required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_part_requests_conformity_decision ON public.part_requests;
CREATE TRIGGER trg_part_requests_conformity_decision
BEFORE UPDATE ON public.part_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_request_conformity_on_decision();


-- 3) Auto-setup profile + default role on login/register (no auth schema triggers)
CREATE OR REPLACE FUNCTION public.ensure_user_setup(
  p_first_name TEXT DEFAULT NULL,
  p_last_name  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create profile if missing; fill names if currently NULL/blank
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (v_uid, p_first_name, p_last_name)
  ON CONFLICT (id) DO UPDATE
    SET first_name = CASE
        WHEN (public.profiles.first_name IS NULL OR public.profiles.first_name = '')
             AND EXCLUDED.first_name IS NOT NULL
          THEN EXCLUDED.first_name
        ELSE public.profiles.first_name
      END,
      last_name = CASE
        WHEN (public.profiles.last_name IS NULL OR public.profiles.last_name = '')
             AND EXCLUDED.last_name IS NOT NULL
          THEN EXCLUDED.last_name
        ELSE public.profiles.last_name
      END,
      updated_at = now();

  -- Assign default operator role only if user has no roles at all
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_uid
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'operator'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_setup(TEXT, TEXT) TO authenticated;


-- 4) Fix missing triggers so actions are visible + journalized
-- 4a) updated_at
DROP TRIGGER IF EXISTS trg_part_requests_updated_at ON public.part_requests;
CREATE TRIGGER trg_part_requests_updated_at
BEFORE UPDATE ON public.part_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_part_reports_updated_at ON public.part_reports;
CREATE TRIGGER trg_part_reports_updated_at
BEFORE UPDATE ON public.part_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();


-- 4b) Audit functions (include conformity + 'closed' status)
CREATE OR REPLACE FUNCTION public.audit_part_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action TEXT;
  v_user_name TEXT;
BEGIN
  SELECT COALESCE(first_name || ' ' || last_name, 'Système')
  INTO v_user_name
  FROM profiles
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := 'Demande créée';

    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, new_values)
    VALUES (
      v_action,
      'request'::entity_type,
      NEW.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object(
        'request_number', NEW.request_number,
        'status', NEW.status,
        'quantity', NEW.quantity_requested
      )
    );

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'pending'::request_status AND OLD.status = 'draft'::request_status THEN
      v_action := 'Demande soumise';
    ELSIF NEW.status = 'approved'::request_status AND OLD.status <> 'approved'::request_status THEN
      v_action := 'Demande approuvée';
    ELSIF NEW.status = 'rejected'::request_status AND OLD.status <> 'rejected'::request_status THEN
      v_action := 'Demande rejetée';
    ELSE
      v_action := 'Demande modifiée';
    END IF;

    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values, new_values)
    VALUES (
      v_action,
      'request'::entity_type,
      NEW.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object(
        'status', NEW.status,
        'rejection_reason', NEW.rejection_reason,
        'conformity', NEW.conformity
      )
    );

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'Demande supprimée';

    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values)
    VALUES (
      v_action,
      'request'::entity_type,
      OLD.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('request_number', OLD.request_number)
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_part_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action TEXT;
  v_user_name TEXT;
BEGIN
  SELECT COALESCE(first_name || ' ' || last_name, 'Système')
  INTO v_user_name
  FROM profiles
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action := 'Signalement créé';

    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, new_values)
    VALUES (
      v_action,
      'report'::entity_type,
      NEW.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('issue_type', NEW.issue_type, 'status', NEW.status)
    );

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'resolved'::report_status AND OLD.status <> 'resolved'::report_status THEN
      v_action := 'Signalement résolu';
    ELSIF NEW.status = 'closed'::report_status AND OLD.status <> 'closed'::report_status THEN
      v_action := 'Signalement fermé';
    ELSE
      v_action := 'Signalement modifié';
    END IF;

    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values, new_values)
    VALUES (
      v_action,
      'report'::entity_type,
      NEW.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status, 'resolution_comment', NEW.resolution_comment)
    );

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values)
    VALUES (
      'Signalement supprimé',
      'report'::entity_type,
      OLD.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('issue_type', OLD.issue_type)
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_part_requests ON public.part_requests;
CREATE TRIGGER trg_audit_part_requests
AFTER INSERT OR UPDATE OR DELETE ON public.part_requests
FOR EACH ROW
EXECUTE FUNCTION public.audit_part_requests();

DROP TRIGGER IF EXISTS trg_audit_part_reports ON public.part_reports;
CREATE TRIGGER trg_audit_part_reports
AFTER INSERT OR UPDATE OR DELETE ON public.part_reports
FOR EACH ROW
EXECUTE FUNCTION public.audit_part_reports();
