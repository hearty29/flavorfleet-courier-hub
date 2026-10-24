-- Let a customer see only the name and photo of the rider handling their order.
CREATE OR REPLACE FUNCTION public.order_rider(_order uuid)
RETURNS TABLE(full_name text, profile_image_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order
      AND (o.customer_id = auth.uid()
           OR o.rider_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin'))
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT p.full_name, p.profile_image_url
    FROM public.orders o
    JOIN public.profiles p ON p.id = o.rider_id
    WHERE o.id = _order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.order_rider(uuid) TO authenticated;

-- Profile photos are meant to be shown to other users (e.g. customers see their rider).
-- The workspace blocks fully public buckets, so allow any signed-in user to read them instead.
CREATE POLICY "signed-in users read profile pictures"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-pictures');