-- Fix search_path for update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix search_path for generate_request_number function
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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