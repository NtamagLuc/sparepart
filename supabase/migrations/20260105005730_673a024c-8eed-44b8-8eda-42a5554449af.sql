-- ==========================================
-- PHASE 1: Types énumérés
-- ==========================================

-- Rôles de l'application
CREATE TYPE public.app_role AS ENUM ('operator', 'maintenance_manager', 'admin');

-- Statuts des demandes
CREATE TYPE public.request_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- Raisons de demande
CREATE TYPE public.request_reason AS ENUM ('missing', 'insufficient', 'non_conform', 'preventive', 'corrective');

-- Niveaux d'urgence
CREATE TYPE public.urgency_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Types d'entités pour l'audit
CREATE TYPE public.entity_type AS ENUM ('request', 'part', 'user', 'stock');

-- Types de notifications
CREATE TYPE public.notification_type AS ENUM ('request_created', 'request_approved', 'request_rejected', 'stock_low', 'part_non_conform', 'role_assigned');

-- ==========================================
-- PHASE 2: Tables principales
-- ==========================================

-- Table des profils utilisateurs
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    department TEXT,
    employee_id TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des rôles utilisateurs (séparée pour la sécurité)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, role)
);

-- Table des pièces de rechange
CREATE TABLE public.spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    location TEXT,
    current_quantity INTEGER NOT NULL DEFAULT 0,
    minimum_quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'unité',
    unit_price DECIMAL(12, 2),
    supplier TEXT,
    manufacturer TEXT,
    manufacturer_ref TEXT,
    is_critical BOOLEAN NOT NULL DEFAULT false,
    is_non_conform BOOLEAN NOT NULL DEFAULT false,
    non_conform_reason TEXT,
    equipment_compatibility TEXT[],
    sap_article_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Table des images des pièces
CREATE TABLE public.part_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by UUID REFERENCES auth.users(id)
);

-- Table des demandes de pièces
CREATE TABLE public.part_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT NOT NULL UNIQUE,
    part_id UUID NOT NULL REFERENCES public.spare_parts(id),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    quantity_requested INTEGER NOT NULL,
    reason public.request_reason NOT NULL,
    urgency public.urgency_level NOT NULL DEFAULT 'medium',
    status public.request_status NOT NULL DEFAULT 'draft',
    description TEXT,
    equipment_name TEXT,
    equipment_location TEXT,
    justification TEXT,
    
    -- Champs de validation
    validator_id UUID REFERENCES auth.users(id),
    validated_at TIMESTAMPTZ,
    validation_comment TEXT,
    rejection_reason TEXT,
    
    -- Référence ERP
    erp_reference TEXT,
    erp_transmitted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ
);

-- Table des logs d'audit
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type public.entity_type NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    user_name TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type public.entity_type,
    entity_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- PHASE 3: Index pour les performances
-- ==========================================

CREATE INDEX idx_spare_parts_code ON public.spare_parts(code);
CREATE INDEX idx_spare_parts_category ON public.spare_parts(category);
CREATE INDEX idx_spare_parts_low_stock ON public.spare_parts(current_quantity, minimum_quantity) WHERE current_quantity <= minimum_quantity;
CREATE INDEX idx_part_images_part_id ON public.part_images(part_id);
CREATE INDEX idx_part_requests_requester ON public.part_requests(requester_id);
CREATE INDEX idx_part_requests_status ON public.part_requests(status);
CREATE INDEX idx_part_requests_number ON public.part_requests(request_number);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ==========================================
-- PHASE 4: Fonctions de sécurité
-- ==========================================

-- Fonction pour vérifier si un utilisateur a un rôle spécifique
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Fonction pour récupérer tous les rôles d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS public.app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(role), ARRAY[]::public.app_role[])
    FROM public.user_roles
    WHERE user_id = _user_id
$$;

-- Fonction pour vérifier si un utilisateur est manager ou admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role IN ('maintenance_manager', 'admin')
    )
$$;

-- ==========================================
-- PHASE 5: Enable RLS
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.part_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PHASE 6: Politiques RLS
-- ==========================================

-- Profiles: Lecture pour tous les authentifiés, modification pour soi-même ou admin
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- User roles: Lecture pour tous, modification par admin
CREATE POLICY "user_roles_select" ON public.user_roles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "user_roles_insert" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_update" ON public.user_roles
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_delete" ON public.user_roles
    FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Spare parts: Lecture pour tous, modification par admin
CREATE POLICY "spare_parts_select" ON public.spare_parts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "spare_parts_insert" ON public.spare_parts
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "spare_parts_update" ON public.spare_parts
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "spare_parts_delete" ON public.spare_parts
    FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Part images: Lecture pour tous, modification par admin
CREATE POLICY "part_images_select" ON public.part_images
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "part_images_insert" ON public.part_images
    FOR INSERT TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "part_images_update" ON public.part_images
    FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "part_images_delete" ON public.part_images
    FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Part requests: Règles complexes selon le rôle
CREATE POLICY "part_requests_select" ON public.part_requests
    FOR SELECT TO authenticated
    USING (
        requester_id = auth.uid() 
        OR public.is_manager_or_admin(auth.uid())
    );

CREATE POLICY "part_requests_insert" ON public.part_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        requester_id = auth.uid() 
        AND NOT public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "part_requests_update" ON public.part_requests
    FOR UPDATE TO authenticated
    USING (
        (requester_id = auth.uid() AND status = 'draft')
        OR (
            public.has_role(auth.uid(), 'maintenance_manager')
            AND status = 'pending'
            AND requester_id != auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin')
    );

CREATE POLICY "part_requests_delete" ON public.part_requests
    FOR DELETE TO authenticated
    USING (
        (requester_id = auth.uid() AND status = 'draft')
        OR public.has_role(auth.uid(), 'admin')
    );

-- Audit logs: Lecture pour managers et admins
CREATE POLICY "audit_logs_select" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "audit_logs_insert" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Notifications: Chaque utilisateur voit ses propres notifications
CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ==========================================
-- PHASE 7: Triggers automatiques
-- ==========================================

-- Trigger pour créer un profil et assigner le rôle operator à chaque nouvel utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Créer le profil
    INSERT INTO public.profiles (id, first_name, last_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    
    -- Assigner le rôle operator par défaut
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'operator');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_spare_parts_updated_at
    BEFORE UPDATE ON public.spare_parts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_part_requests_updated_at
    BEFORE UPDATE ON public.part_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- Trigger pour générer le numéro de demande automatiquement
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    year_prefix TEXT;
    sequence_num INTEGER;
BEGIN
    year_prefix := 'DEM-' || to_char(now(), 'YYYY') || '-';
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 10) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM public.part_requests
    WHERE request_number LIKE year_prefix || '%';
    
    NEW.request_number := year_prefix || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER generate_request_number_trigger
    BEFORE INSERT ON public.part_requests
    FOR EACH ROW
    WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
    EXECUTE FUNCTION public.generate_request_number();

-- Trigger pour enregistrer les modifications de statut dans l'audit
CREATE OR REPLACE FUNCTION public.log_request_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_full_name TEXT;
BEGIN
    -- Récupérer le nom de l'utilisateur
    SELECT COALESCE(first_name || ' ' || last_name, 'Système')
    INTO user_full_name
    FROM public.profiles
    WHERE id = auth.uid();
    
    -- Enregistrer le changement de statut
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.audit_logs (
            entity_type,
            entity_id,
            action,
            old_values,
            new_values,
            user_id,
            user_name
        ) VALUES (
            'request',
            NEW.id,
            'status_change',
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status, 'comment', COALESCE(NEW.validation_comment, NEW.rejection_reason)),
            auth.uid(),
            user_full_name
        );
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER log_request_status_change_trigger
    AFTER UPDATE ON public.part_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.log_request_status_change();

-- Trigger pour notifier les managers lors d'une nouvelle demande
CREATE OR REPLACE FUNCTION public.notify_managers_on_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    manager_id UUID;
    requester_name TEXT;
    part_name TEXT;
BEGIN
    -- Récupérer le nom du demandeur
    SELECT COALESCE(first_name || ' ' || last_name, 'Un utilisateur')
    INTO requester_name
    FROM public.profiles
    WHERE id = NEW.requester_id;
    
    -- Récupérer le nom de la pièce
    SELECT name INTO part_name
    FROM public.spare_parts
    WHERE id = NEW.part_id;
    
    -- Notifier tous les managers
    FOR manager_id IN 
        SELECT user_id FROM public.user_roles WHERE role = 'maintenance_manager'
    LOOP
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            entity_type,
            entity_id
        ) VALUES (
            manager_id,
            'request_created',
            'Nouvelle demande de pièce',
            requester_name || ' a créé une demande pour: ' || COALESCE(part_name, 'Pièce inconnue') || ' (Ref: ' || NEW.request_number || ')',
            'request',
            NEW.id
        );
    END LOOP;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER notify_managers_on_request_trigger
    AFTER INSERT ON public.part_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.notify_managers_on_request();

-- Trigger pour notifier le demandeur lors de la décision
CREATE OR REPLACE FUNCTION public.notify_requester_on_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    validator_name TEXT;
    part_name TEXT;
    notif_type public.notification_type;
    notif_title TEXT;
    notif_message TEXT;
BEGIN
    -- Seulement si le statut change vers approved ou rejected
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
        -- Récupérer le nom du validateur
        SELECT COALESCE(first_name || ' ' || last_name, 'Un responsable')
        INTO validator_name
        FROM public.profiles
        WHERE id = NEW.validator_id;
        
        -- Récupérer le nom de la pièce
        SELECT name INTO part_name
        FROM public.spare_parts
        WHERE id = NEW.part_id;
        
        IF NEW.status = 'approved' THEN
            notif_type := 'request_approved';
            notif_title := 'Demande approuvée';
            notif_message := 'Votre demande ' || NEW.request_number || ' pour ' || COALESCE(part_name, 'une pièce') || ' a été approuvée par ' || validator_name;
        ELSE
            notif_type := 'request_rejected';
            notif_title := 'Demande rejetée';
            notif_message := 'Votre demande ' || NEW.request_number || ' a été rejetée. Motif: ' || COALESCE(NEW.rejection_reason, 'Non spécifié');
        END IF;
        
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            entity_type,
            entity_id
        ) VALUES (
            NEW.requester_id,
            notif_type,
            notif_title,
            notif_message,
            'request',
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER notify_requester_on_decision_trigger
    AFTER UPDATE ON public.part_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_requester_on_decision();

-- ==========================================
-- PHASE 8: Storage bucket pour les images
-- ==========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('part-images', 'part-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture publique pour les images
CREATE POLICY "part_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'part-images');

-- Politique d'upload pour les admins
CREATE POLICY "part_images_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'part-images' 
    AND public.has_role(auth.uid(), 'admin')
);

-- Politique de suppression pour les admins
CREATE POLICY "part_images_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'part-images' 
    AND public.has_role(auth.uid(), 'admin')
);

-- ==========================================
-- PHASE 9: Activer Realtime pour les notifications
-- ==========================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;