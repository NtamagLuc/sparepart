-- Ajouter 'report' à l'enum entity_type pour les notifications de signalement
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'report';

-- Ajouter 'report_submitted' à l'enum notification_type
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'report_submitted';