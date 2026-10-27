ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_of_delivery_path text;
CREATE OR REPLACE FUNCTION public.has_rider_photo(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles p JOIN storage.objects s ON s.bucket_id='profile-pictures' AND p.profile_image_url LIKE '%/object/public/profile-pictures/' || s.name WHERE p.id=_user AND split_part(s.name,'/',1)=_user::text);
$$;
REVOKE ALL ON FUNCTION public.has_rider_photo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_rider_photo(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.require_application_photo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_rider_photo(NEW.user_id) THEN RAISE EXCEPTION 'Upload your profile picture before applying as a rider'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER require_application_photo BEFORE INSERT ON public.rider_applications FOR EACH ROW EXECUTE FUNCTION public.require_application_photo();
CREATE OR REPLACE FUNCTION public.rider_accept_order(_order uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'rider') THEN RAISE EXCEPTION 'Not a rider'; END IF;
 IF NOT public.has_rider_photo(auth.uid()) THEN RAISE EXCEPTION 'Upload your profile picture before accepting orders'; END IF;
 UPDATE public.orders SET rider_id=auth.uid(), updated_at=now() WHERE id=_order AND rider_id IS NULL AND status='ready';
 IF NOT FOUND THEN RAISE EXCEPTION 'Order already taken'; END IF;
END; $$;
CREATE POLICY "delivery proof assigned rider upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='delivery-proofs' AND split_part(name,'/',1)=auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','avif') AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id::text=split_part(name,'/',2) AND o.rider_id=auth.uid() AND o.status='picked_up')
);
CREATE POLICY "delivery proof participants read" ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='delivery-proofs' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id::text=split_part(name,'/',2) AND o.rider_id::text=split_part(name,'/',1) AND (o.customer_id=auth.uid() OR o.rider_id=auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "delivery proof unlinked owner cleanup" ON storage.objects FOR DELETE TO authenticated USING (
 bucket_id='delivery-proofs' AND split_part(name,'/',1)=auth.uid()::text AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.proof_of_delivery_path=name)
);
CREATE OR REPLACE FUNCTION public.require_delivery_proof() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,storage AS $$
BEGIN
 IF NEW.status='delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
  IF OLD.status <> 'picked_up' THEN RAISE EXCEPTION 'Pick up the order before marking it delivered'; END IF;
  IF NEW.rider_id IS NULL OR NEW.proof_of_delivery_path IS NULL OR NOT EXISTS (SELECT 1 FROM storage.objects s WHERE s.bucket_id='delivery-proofs' AND s.name=NEW.proof_of_delivery_path AND split_part(s.name,'/',1)=NEW.rider_id::text AND split_part(s.name,'/',2)=NEW.id::text) THEN RAISE EXCEPTION 'Upload a delivery proof photo before marking this order delivered'; END IF;
 END IF;
 IF OLD.status='delivered' AND (NEW.proof_of_delivery_path IS DISTINCT FROM OLD.proof_of_delivery_path OR NEW.rider_id IS DISTINCT FROM OLD.rider_id) THEN RAISE EXCEPTION 'Delivered order proof cannot be changed'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER require_delivery_proof BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.require_delivery_proof();
CREATE OR REPLACE FUNCTION public.rider_complete_delivery(_order uuid, _proof_path text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'rider') THEN RAISE EXCEPTION 'Not a rider'; END IF;
 UPDATE public.orders SET status='delivered', proof_of_delivery_path=_proof_path, updated_at=now() WHERE id=_order AND rider_id=auth.uid() AND status='picked_up';
 IF NOT FOUND THEN RAISE EXCEPTION 'Cannot deliver this order'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.rider_complete_delivery(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_complete_delivery(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.rider_update_status(_order uuid, _status public.order_status) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'rider') THEN RAISE EXCEPTION 'Not a rider'; END IF;
 IF _status <> 'picked_up' THEN RAISE EXCEPTION 'Upload delivery proof to mark this order delivered'; END IF;
 UPDATE public.orders SET status=_status,updated_at=now() WHERE id=_order AND rider_id=auth.uid() AND status='ready';
 IF NOT FOUND THEN RAISE EXCEPTION 'Cannot update order'; END IF;
END; $$;