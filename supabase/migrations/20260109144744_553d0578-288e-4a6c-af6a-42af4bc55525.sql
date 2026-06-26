-- Fix: Allow all operators to create requests (not just those without other roles)
-- The issue is that some users might have operator role but the policy is too restrictive

DROP POLICY IF EXISTS part_requests_insert ON public.part_requests;

CREATE POLICY part_requests_insert ON public.part_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requester_id = auth.uid() 
  AND has_role(auth.uid(), 'operator')
);

-- Also ensure operators can update their drafts to pending
DROP POLICY IF EXISTS part_requests_update ON public.part_requests;

CREATE POLICY part_requests_update ON public.part_requests
FOR UPDATE
TO authenticated
USING (
  -- Operators can update their own drafts
  (requester_id = auth.uid() AND status = 'draft' AND has_role(auth.uid(), 'operator'))
  OR
  -- Managers can update pending requests they didn't create
  (has_role(auth.uid(), 'maintenance_manager') AND status = 'pending' AND requester_id <> auth.uid())
  OR
  -- Admins can update any request
  has_role(auth.uid(), 'admin')
)
WITH CHECK (
  -- Operators can only set draft or pending status on their own requests
  (requester_id = auth.uid() AND has_role(auth.uid(), 'operator') AND status IN ('draft', 'pending'))
  OR
  -- Managers can approve/reject pending requests
  (has_role(auth.uid(), 'maintenance_manager') AND requester_id <> auth.uid() AND status IN ('approved', 'rejected'))
  OR
  -- Admins can do anything
  has_role(auth.uid(), 'admin')
);

-- Verify decrement_stock_on_approval trigger exists and fix if needed
DROP TRIGGER IF EXISTS trigger_decrement_stock ON public.part_requests;

CREATE OR REPLACE FUNCTION public.decrement_stock_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only decrement when status changes to 'approved'
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

CREATE TRIGGER trigger_decrement_stock
AFTER UPDATE ON public.part_requests
FOR EACH ROW
EXECUTE FUNCTION public.decrement_stock_on_approval();