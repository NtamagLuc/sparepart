-- Création des enums pour les signalements
CREATE TYPE public.report_status AS ENUM ('pending', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.report_issue_type AS ENUM ('damaged', 'defective', 'wrong_reference', 'other');

-- Création de la table des centrales (power_plants)
CREATE TABLE public.power_plants (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    location TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.power_plants ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les centrales
CREATE POLICY "power_plants_select" ON public.power_plants
FOR SELECT USING (true);

-- Seul l'admin peut modifier
CREATE POLICY "power_plants_insert" ON public.power_plants
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "power_plants_update" ON public.power_plants
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "power_plants_delete" ON public.power_plants
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Insertion des centrales initiales
INSERT INTO public.power_plants (name, code, location) VALUES
('Centrale Hydroélectrique de Lagdo', 'LAGDO', 'Lagdo, Nord'),
('Centrale Hydroélectrique de Song Loulou', 'SONG-LOULOU', 'Song Loulou, Littoral'),
('Centrale Hydroélectrique d''Edéa', 'EDEA', 'Edéa, Littoral'),
('Centrale Thermique de Kribi', 'KRIBI', 'Kribi, Sud'),
('Centrale Thermique de Yassa', 'YASSA', 'Douala, Littoral'),
('Centrale Thermique de Limbé', 'LIMBE', 'Limbé, Sud-Ouest'),
('Centrale Solaire de Maroua', 'MAROUA-SOL', 'Maroua, Extrême-Nord'),
('Centrale Hydroélectrique de Nachtigal', 'NACHTIGAL', 'Nachtigal, Centre');

-- Création de la table des signalements (part_reports)
CREATE TABLE public.part_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    part_id UUID NOT NULL REFERENCES public.spare_parts(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL,
    status public.report_status NOT NULL DEFAULT 'pending',
    issue_type public.report_issue_type NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_comment TEXT
);

-- Enable RLS
ALTER TABLE public.part_reports ENABLE ROW LEVEL SECURITY;

-- Exploitants peuvent créer des signalements (pas les managers ni admins)
CREATE POLICY "part_reports_insert" ON public.part_reports
FOR INSERT WITH CHECK (
    reporter_id = auth.uid() 
    AND NOT public.is_manager_or_admin(auth.uid())
);

-- Exploitants voient leurs signalements, managers/admins voient tout
CREATE POLICY "part_reports_select" ON public.part_reports
FOR SELECT USING (
    reporter_id = auth.uid() 
    OR public.is_manager_or_admin(auth.uid())
);

-- Managers peuvent mettre à jour le statut, admins peuvent tout modifier
CREATE POLICY "part_reports_update" ON public.part_reports
FOR UPDATE USING (
    public.has_role(auth.uid(), 'maintenance_manager') 
    OR public.has_role(auth.uid(), 'admin')
);

-- Seul l'admin peut supprimer
CREATE POLICY "part_reports_delete" ON public.part_reports
FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Trigger pour updated_at
CREATE TRIGGER update_part_reports_updated_at
BEFORE UPDATE ON public.part_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Fonction pour notifier le manager lors d'un nouveau signalement
CREATE OR REPLACE FUNCTION public.notify_managers_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    manager_id UUID;
    reporter_name TEXT;
    part_name TEXT;
BEGIN
    -- Récupérer le nom du signaleur
    SELECT COALESCE(first_name || ' ' || last_name, 'Un exploitant')
    INTO reporter_name
    FROM public.profiles
    WHERE id = NEW.reporter_id;
    
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
            'part_non_conform',
            'Nouveau signalement de pièce',
            reporter_name || ' a signalé un problème sur: ' || COALESCE(part_name, 'Pièce inconnue'),
            'part',
            NEW.part_id
        );
    END LOOP;
    
    RETURN NEW;
END;
$function$;

-- Trigger pour les notifications de signalement
CREATE TRIGGER notify_on_new_report
AFTER INSERT ON public.part_reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_managers_on_report();

-- Ajouter power_plant_id à part_requests pour remplacer equipment_location
ALTER TABLE public.part_requests 
ADD COLUMN power_plant_id UUID REFERENCES public.power_plants(id);