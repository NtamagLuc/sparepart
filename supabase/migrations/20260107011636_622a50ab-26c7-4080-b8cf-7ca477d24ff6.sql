-- Fix linter: avoid overly permissive notifications INSERT policy
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
