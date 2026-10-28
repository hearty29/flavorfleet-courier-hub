\set ON_ERROR_STOP on
-- Run only against an EMPTY disposable local database as its superuser:
-- psql -X -v ON_ERROR_STOP=1 -d <test_database> -f scripts/test-order-types.sql
-- Minimal Supabase auth/storage scaffolding for real PostgreSQL RPC/RLS tests.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1, '/'); $$;
CREATE FUNCTION storage.extension(text) RETURNS text LANGUAGE sql AS $$ SELECT reverse(split_part(reverse($1), '.', 1)); $$;
GRANT USAGE ON SCHEMA auth, storage TO authenticated, anon, service_role;
GRANT SELECT ON storage.objects TO authenticated;
CREATE PUBLICATION supabase_realtime;
\ir ../drizzle/migrations/0000_migration.sql
\ir ../drizzle/migrations/0001_rider_verification_uploads.sql
\ir ../drizzle/migrations/0002_share_rider_with_customer.sql
\ir ../drizzle/migrations/0003_court_bookings.sql
\ir ../drizzle/migrations/0004_resolve_order_rider_from_application.sql
\ir ../drizzle/migrations/0005_require_rider_photo_and_delivery_proof.sql
\ir ../drizzle/migrations/0006_private_support_chat.sql

-- Predictable synthetic admin/customer/rider/unrelated-customer identities.
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000004');
INSERT INTO public.user_roles(user_id, role) VALUES ('00000000-0000-0000-0000-000000000003', 'rider');
INSERT INTO storage.objects(bucket_id, name) VALUES ('profile-pictures', '00000000-0000-0000-0000-000000000003/photo.jpg');
UPDATE public.profiles SET profile_image_url = 'https://example.invalid/storage/v1/object/public/profile-pictures/00000000-0000-0000-0000-000000000003/photo.jpg'
WHERE id = '00000000-0000-0000-0000-000000000003';
INSERT INTO public.menu_items(id, name, price) VALUES ('10000000-0000-0000-0000-000000000001', 'Test dish', 99);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT public.place_order('[{"id":"10000000-0000-0000-0000-000000000001","quantity":2}]', 'Legacy address', '09123', 'Customer', '', 'cod') AS legacy_id \gset
\ir ../drizzle/migrations/0007_order_types.sql

CREATE FUNCTION public.test_assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', message; END IF; END; $$;
CREATE FUNCTION public.test_reject(command text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM) = 0 THEN RAISE EXCEPTION 'Expected %, got %', expected, SQLERRM; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected rejection: %', command;
END; $$;
GRANT EXECUTE ON FUNCTION public.test_assert(boolean,text), public.test_reject(text,text) TO authenticated, anon;

SELECT test_assert(order_type = 'delivery' AND delivery_fee = 49 AND total = 247, 'legacy order preserved') FROM orders WHERE id = :'legacy_id';
SET ROLE authenticated;
SELECT public.place_order('[{"id":"10000000-0000-0000-0000-000000000001","quantity":2,"price":1}]', '', '09123', 'Customer', 'Pickup', 'counter', 'counter') AS counter_id \gset
SELECT public.place_order('[{"id":"10000000-0000-0000-0000-000000000001","quantity":2}]', 'Delivery address', '09123', 'Customer', '', 'cod') AS delivery_id \gset
SELECT test_assert(order_type = 'counter' AND delivery_fee = 0 AND total = 198 AND payment_method = 'counter', 'counter server pricing and payment') FROM orders WHERE id = :'counter_id';
SELECT test_assert(order_type = 'delivery' AND delivery_fee = 49 AND total = 247, 'six argument delivery compatibility') FROM orders WHERE id = :'delivery_id';
SELECT test_reject($q$SELECT place_order('[]', '', '09', 'Test', '', 'counter', 'counter')$q$, 'Cart is empty');
SELECT test_reject($q$SELECT place_order('[]', '', '09', 'Test', '', 'cod', 'invalid')$q$, 'Invalid order type');
SELECT test_reject($q$SELECT place_order('[{"id":"10000000-0000-0000-0000-000000000001"}]', '', '09', 'Test', '', 'cod', 'delivery')$q$, 'Delivery address is required');
SELECT test_reject($q$SELECT place_order('[{"id":"10000000-0000-0000-0000-000000000001"}]', '', '09', 'Test', '', 'gcash', 'counter')$q$, 'Unsupported payment method');
SELECT test_reject(format('SELECT admin_claim_counter_order(%L)', :'counter_id'), 'Admin access required');
SELECT test_assert(count(*) = 3, 'customer sees their three orders') FROM orders;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
SELECT test_assert(count(*) = 0, 'unrelated customer cannot see orders') FROM orders;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT test_assert(count(*) = 3, 'admin sees customer delivery and counter orders') FROM orders;
SELECT test_reject(format('SELECT admin_claim_counter_order(%L)', :'counter_id'), 'must be ready');
SELECT test_reject(format('UPDATE orders SET order_type = ''counter'', delivery_fee = 0 WHERE id = %L', :'delivery_id'), 'Order type cannot be changed');
UPDATE orders SET status = 'ready' WHERE id IN (:'counter_id', :'delivery_id');
SELECT test_reject(format('UPDATE orders SET status = ''picked_up'' WHERE id = %L', :'counter_id'), 'orders_counter_fulfillment');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT test_assert(count(*) = 1, 'rider sees ready delivery only') FROM orders;
SELECT test_assert(count(*) = 0, 'rider cannot read counter items') FROM order_items WHERE order_id = :'counter_id';
SELECT test_reject(format('SELECT rider_accept_order(%L)', :'counter_id'), 'unavailable for delivery');
SELECT rider_accept_order(:'delivery_id');
SELECT rider_update_status(:'delivery_id', 'picked_up');
SELECT test_reject(format('SELECT rider_complete_delivery(%L, %L)', :'delivery_id', 'missing.jpg'), 'Upload a delivery proof');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT test_reject(format('SELECT admin_claim_counter_order(%L)', :'delivery_id'), 'must be ready');
SELECT test_reject(format('UPDATE orders SET status = ''delivered'' WHERE id = %L', :'delivery_id'), 'Upload a delivery proof');
SELECT admin_claim_counter_order(:'counter_id');
SELECT test_assert(status = 'delivered' AND rider_id IS NULL AND proof_of_delivery_path IS NULL, 'admin claims counter without rider or photo') FROM orders WHERE id = :'counter_id';
SELECT test_reject(format('SELECT admin_claim_counter_order(%L)', :'counter_id'), 'must be ready');
RESET ROLE;
INSERT INTO storage.objects(bucket_id, name) VALUES ('delivery-proofs', '00000000-0000-0000-0000-000000000003/' || :'delivery_id' || '/proof.jpg');
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT rider_complete_delivery(:'delivery_id', '00000000-0000-0000-0000-000000000003/' || :'delivery_id' || '/proof.jpg');
SELECT test_assert(status = 'delivered', 'delivery with valid photo completes') FROM orders WHERE id = :'delivery_id';
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT test_reject(format('UPDATE orders SET proof_of_delivery_path = NULL WHERE id = %L', :'delivery_id'), 'Delivered order proof cannot be changed');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT test_reject($q$SELECT place_order('[{"id":"10000000-0000-0000-0000-000000000001"},{"id":"10000000-0000-0000-0000-000000000099"}]', '', '09', 'Test', '', 'counter', 'counter')$q$, 'Item unavailable');
SELECT test_assert(count(*) = 3, 'failed cart rolls back order and items') FROM orders;
RESET ROLE;
SET ROLE anon;
SELECT test_reject($q$SELECT place_order('[]', '', '', '', '', 'cod', 'delivery')$q$, 'permission denied');
RESET ROLE;
\echo 'Order type SQL integration checks passed'
