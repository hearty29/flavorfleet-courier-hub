CREATE OR REPLACE FUNCTION public.order_rider(_order uuid)
RETURNS TABLE(full_name text, profile_image_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    SELECT COALESCE(application.full_name, NULLIF(BTRIM(p.full_name), '')), p.profile_image_url
    FROM public.orders o
    LEFT JOIN public.profiles p ON p.id = o.rider_id
    LEFT JOIN LATERAL (
      SELECT NULLIF(BTRIM(a.full_name), '') AS full_name
      FROM public.rider_applications a
      WHERE a.user_id = o.rider_id
        AND a.status = 'approved'
        AND NULLIF(BTRIM(a.full_name), '') IS NOT NULL
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 1
    ) application ON TRUE
    WHERE o.id = _order AND o.rider_id IS NOT NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.order_rider(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_rider(uuid) TO authenticated, service_role;