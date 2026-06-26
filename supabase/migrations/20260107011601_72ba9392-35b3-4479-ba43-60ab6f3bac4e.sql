-- Fix manager approve/reject: separate UPDATE USING vs WITH CHECK
DROP POLICY IF EXISTS part_requests_update ON public.part_requests;
CREATE POLICY part_requests_update
ON public.part_requests
FOR UPDATE
USING (
  (
    requester_id = auth.uid()
    AND status = 'draft'::public.request_status
  )
  OR (
    public.has_role(auth.uid(), 'maintenance_manager'::public.app_role)
    AND status = 'pending'::public.request_status
    AND requester_id <> auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  (
    requester_id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
    AND status IN ('draft'::public.request_status, 'pending'::public.request_status)
  )
  OR (
    public.has_role(auth.uid(), 'maintenance_manager'::public.app_role)
    AND requester_id <> auth.uid()
    AND status IN ('approved'::public.request_status, 'rejected'::public.request_status)
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Ensure audit logs always reflect the authenticated actor
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert
ON public.audit_logs
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);
