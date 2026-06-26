-- 1. Trigger pour décrémente le stock quand une demande est approuvée
CREATE OR REPLACE FUNCTION public.decrement_stock_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérifier si le statut passe à 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE spare_parts
    SET current_quantity = GREATEST(0, current_quantity - NEW.quantity_requested),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = NEW.part_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger sur part_requests
DROP TRIGGER IF EXISTS trigger_decrement_stock_on_approval ON public.part_requests;
CREATE TRIGGER trigger_decrement_stock_on_approval
  AFTER UPDATE ON public.part_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_stock_on_approval();

-- 2. Fonction générique pour créer des entrées d'audit
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_action TEXT,
  p_entity_type public.entity_type,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
  v_log_id UUID;
BEGIN
  -- Récupérer le nom de l'utilisateur
  SELECT COALESCE(first_name || ' ' || last_name, 'Système')
  INTO v_user_name
  FROM profiles
  WHERE id = auth.uid();
  
  INSERT INTO audit_logs (
    action,
    entity_type,
    entity_id,
    user_id,
    user_name,
    old_values,
    new_values
  ) VALUES (
    p_action,
    p_entity_type,
    p_entity_id,
    auth.uid(),
    COALESCE(v_user_name, 'Système'),
    p_old_values,
    p_new_values
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 3. Trigger pour audit automatique des demandes
CREATE OR REPLACE FUNCTION public.audit_part_requests()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_user_name TEXT;
BEGIN
  -- Récupérer le nom de l'utilisateur
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
    -- Déterminer le type d'action
    IF NEW.status = 'pending' AND OLD.status = 'draft' THEN
      v_action := 'Demande soumise';
    ELSIF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
      v_action := 'Demande approuvée';
    ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
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
        'rejection_reason', NEW.rejection_reason
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

DROP TRIGGER IF EXISTS trigger_audit_part_requests ON public.part_requests;
CREATE TRIGGER trigger_audit_part_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.part_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_part_requests();

-- 4. Trigger pour audit automatique des signalements
CREATE OR REPLACE FUNCTION public.audit_part_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
      v_action := 'Signalement résolu';
    ELSIF NEW.status = 'rejected' AND OLD.status <> 'rejected' THEN
      v_action := 'Signalement rejeté';
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

DROP TRIGGER IF EXISTS trigger_audit_part_reports ON public.part_reports;
CREATE TRIGGER trigger_audit_part_reports
  AFTER INSERT OR UPDATE OR DELETE ON public.part_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_part_reports();

-- 5. Trigger pour audit des modifications de stock
CREATE OR REPLACE FUNCTION public.audit_spare_parts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT COALESCE(first_name || ' ' || last_name, 'Système')
  INTO v_user_name
  FROM profiles
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, new_values)
    VALUES (
      'Pièce créée',
      'part'::entity_type,
      NEW.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('code', NEW.code, 'name', NEW.name, 'quantity', NEW.current_quantity)
    );
    
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Vérifier si la quantité a changé
    IF OLD.current_quantity <> NEW.current_quantity THEN
      INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values, new_values)
      VALUES (
        'Stock modifié',
        'part'::entity_type,
        NEW.id,
        auth.uid(),
        v_user_name,
        jsonb_build_object('quantity', OLD.current_quantity),
        jsonb_build_object('quantity', NEW.current_quantity)
      );
    ELSE
      INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values, new_values)
      VALUES (
        'Pièce modifiée',
        'part'::entity_type,
        NEW.id,
        auth.uid(),
        v_user_name,
        jsonb_build_object('name', OLD.name),
        jsonb_build_object('name', NEW.name)
      );
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values)
    VALUES (
      'Pièce supprimée',
      'part'::entity_type,
      OLD.id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('code', OLD.code, 'name', OLD.name)
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_spare_parts ON public.spare_parts;
CREATE TRIGGER trigger_audit_spare_parts
  AFTER INSERT OR UPDATE OR DELETE ON public.spare_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_spare_parts();

-- 6. Trigger pour audit des rôles utilisateur
CREATE OR REPLACE FUNCTION public.audit_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
  v_target_name TEXT;
BEGIN
  SELECT COALESCE(first_name || ' ' || last_name, 'Système')
  INTO v_user_name
  FROM profiles
  WHERE id = auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(first_name || ' ' || last_name, 'Utilisateur')
    INTO v_target_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, new_values)
    VALUES (
      'Rôle attribué',
      'user'::entity_type,
      NEW.user_id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('role', NEW.role, 'target_user', v_target_name)
    );
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(first_name || ' ' || last_name, 'Utilisateur')
    INTO v_target_name
    FROM profiles
    WHERE id = OLD.user_id;
    
    INSERT INTO audit_logs (action, entity_type, entity_id, user_id, user_name, old_values)
    VALUES (
      'Rôle retiré',
      'user'::entity_type,
      OLD.user_id,
      auth.uid(),
      v_user_name,
      jsonb_build_object('role', OLD.role, 'target_user', v_target_name)
    );
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_user_roles ON public.user_roles;
CREATE TRIGGER trigger_audit_user_roles
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_user_roles();

-- 7. Fonction pour réinitialiser les données (admin only) - via edge function
-- Autoriser l'admin à supprimer les demandes et signalements
DROP POLICY IF EXISTS part_requests_delete ON public.part_requests;
CREATE POLICY part_requests_delete
ON public.part_requests
FOR DELETE
USING (
  (requester_id = auth.uid() AND status = 'draft'::request_status)
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS part_reports_delete ON public.part_reports;
CREATE POLICY part_reports_delete
ON public.part_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS audit_logs_delete ON public.audit_logs;
CREATE POLICY audit_logs_delete
ON public.audit_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));