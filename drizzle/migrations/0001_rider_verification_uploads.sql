ALTER TABLE public.profiles ADD COLUMN profile_image_url text;
CREATE TABLE public.rider_verifications (
 user_id uuid PRIMARY KEY,
 id_type text,
 id_document_path text,
 id_verification_status text NOT NULL DEFAULT 'not_submitted',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT rider_id_type CHECK (id_type IN ('Driver''s License', 'Passport', 'National ID')),
 CONSTRAINT rider_verification_status CHECK (id_verification_status IN ('not_submitted', 'pending', 'approved', 'rejected'))
);
GRANT SELECT, INSERT, UPDATE ON public.rider_verifications TO authenticated;
GRANT ALL ON public.rider_verifications TO service_role;
ALTER TABLE public.rider_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verification owner or admin read" ON public.rider_verifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "verification owner insert pending" ON public.rider_verifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND id_verification_status = 'pending' AND id_document_path LIKE auth.uid()::text || '/%');
CREATE POLICY "verification owner update pending" ON public.rider_verifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND id_verification_status = 'pending' AND id_document_path LIKE auth.uid()::text || '/%');
CREATE POLICY "profile photo owner read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "profile photo owner upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','avif'));
CREATE POLICY "profile photo owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "rider ID owner admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'rider-ids' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "rider ID owner upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rider-ids' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif','avif','pdf'));
CREATE POLICY "rider ID owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'rider-ids' AND (storage.foldername(name))[1] = auth.uid()::text);
ALTER PUBLICATION supabase_realtime ADD TABLE public.rider_verifications;