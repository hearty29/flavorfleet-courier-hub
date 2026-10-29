BEGIN;

-- Add Government ID while preserving historical documents and approved rider roles.
-- Apply after 0013_required_rider_id.sql.
ALTER TABLE public.rider_verifications DROP CONSTRAINT IF EXISTS rider_id_type;
ALTER TABLE public.rider_verifications ADD CONSTRAINT rider_id_type
  CHECK (id_type IN ('School ID', 'National ID', 'Passport', 'Government ID', 'Driver''s License'));

CREATE OR REPLACE FUNCTION public.validate_rider_id_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.id_type IS DISTINCT FROM OLD.id_type
     OR NEW.id_document_path IS DISTINCT FROM OLD.id_document_path
     OR (NEW.id_verification_status = 'pending' AND OLD.id_verification_status IS DISTINCT FROM 'pending') THEN
    IF NEW.id_type IS NULL OR NEW.id_type NOT IN ('School ID', 'National ID', 'Passport', 'Government ID') THEN
      RAISE EXCEPTION 'Choose School ID, National ID, Passport or Government ID';
    END IF;
    IF NEW.id_document_path IS NULL OR NOT EXISTS (
      SELECT 1 FROM storage.objects s WHERE s.bucket_id = 'rider-ids'
        AND s.name = NEW.id_document_path
        AND split_part(s.name, '/', 1) = NEW.user_id::text
        AND lower(storage.extension(s.name)) IN ('jpg','jpeg','png','webp','gif','avif','pdf')
    ) THEN RAISE EXCEPTION 'Upload your valid ID document before saving'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS validate_rider_id_submission ON public.rider_verifications;
CREATE TRIGGER validate_rider_id_submission BEFORE INSERT OR UPDATE ON public.rider_verifications
  FOR EACH ROW EXECUTE FUNCTION public.validate_rider_id_submission();

CREATE OR REPLACE FUNCTION public.has_rider_application_id(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (auth.uid() = _user OR public.has_role(auth.uid(), 'admin')) AND EXISTS (
    SELECT 1 FROM public.rider_verifications v JOIN storage.objects s
      ON s.bucket_id = 'rider-ids' AND s.name = v.id_document_path
      AND split_part(s.name, '/', 1) = _user::text
      AND lower(storage.extension(s.name)) IN ('jpg','jpeg','png','webp','gif','avif','pdf')
    WHERE v.user_id = _user AND v.id_type IN ('School ID', 'National ID', 'Passport', 'Government ID')
      AND v.id_verification_status IN ('pending', 'approved')
  );
$$;
REVOKE ALL ON FUNCTION public.has_rider_application_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_rider_application_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_application_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved') THEN
    IF NOT coalesce(public.has_rider_application_id(NEW.user_id), false) THEN
      RAISE EXCEPTION 'Upload a School ID, National ID, Passport or Government ID before submitting or approving a rider application';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS require_application_id ON public.rider_applications;
CREATE TRIGGER require_application_id BEFORE INSERT OR UPDATE ON public.rider_applications
  FOR EACH ROW EXECUTE FUNCTION public.require_application_id();

NOTIFY pgrst, 'reload schema';
COMMIT;
