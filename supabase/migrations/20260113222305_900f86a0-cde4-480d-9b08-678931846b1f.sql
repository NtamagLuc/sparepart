
-- =====================================================
-- 1. Ajouter l'enum et la colonne conformité aux demandes
-- =====================================================
CREATE TYPE public.conformity_status AS ENUM ('conform', 'non_conform');

ALTER TABLE public.part_requests 
ADD COLUMN conformity conformity_status DEFAULT NULL;

-- =====================================================
-- 2. Corriger la politique RLS INSERT pour part_requests
-- Le problème: la fonction has_role peut échouer pour les nouveaux utilisateurs
-- car le rôle est vérifié via RLS qui elle-même appelle has_role
-- Solution: Simplifier pour tous les utilisateurs authentifiés avec rôle operator
-- =====================================================
DROP POLICY IF EXISTS part_requests_insert ON public.part_requests;

CREATE POLICY "part_requests_insert" ON public.part_requests
FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'operator'
  )
);

-- =====================================================
-- 3. Corriger la politique RLS UPDATE pour part_reports
-- Permettre aux managers/admins de mettre à jour (y compris fermer)
-- =====================================================
DROP POLICY IF EXISTS part_reports_update ON public.part_reports;

CREATE POLICY "part_reports_update" ON public.part_reports
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('maintenance_manager', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('maintenance_manager', 'admin')
  )
);
