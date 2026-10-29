\set ON_ERROR_STOP on
\ir test-order-types.sql
RESET ROLE;
-- Historical records are retained when the accepted ID list changes.
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('rider-ids','00000000-0000-0000-0000-000000000003/license.pdf'),
 ('profile-pictures','00000000-0000-0000-0000-000000000002/photo.jpg');
INSERT INTO rider_verifications(user_id,id_type,id_document_path,id_verification_status) VALUES
 ('00000000-0000-0000-0000-000000000003','Driver''s License','00000000-0000-0000-0000-000000000003/license.pdf','approved');
UPDATE profiles SET profile_image_url='https://example.invalid/storage/v1/object/public/profile-pictures/00000000-0000-0000-0000-000000000002/photo.jpg' WHERE id='00000000-0000-0000-0000-000000000002';
INSERT INTO rider_applications(id,user_id,full_name,phone,address,vehicle_type,license_number)
 VALUES ('13000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000003','Legacy Rider','09','Test','bicycle','Legacy');
\ir ../drizzle/migrations/0013_required_rider_id.sql
\ir ../drizzle/migrations/0013_required_rider_id.sql
SELECT test_assert(id_type='Driver''s License' AND id_verification_status='approved','legacy ID preserved') FROM rider_verifications WHERE user_id='00000000-0000-0000-0000-000000000003';
SELECT test_assert(has_role('00000000-0000-0000-0000-000000000003','rider'),'existing rider role preserved');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT test_assert(NOT has_rider_application_id(auth.uid()),'no ID not eligible');
SELECT test_reject($q$INSERT INTO rider_applications(user_id,full_name,phone,address,vehicle_type,license_number) VALUES(auth.uid(),'Test','09','Home','bicycle','Test')$q$,'Upload a School ID');
SELECT test_reject($q$INSERT INTO rider_verifications(user_id,id_type,id_document_path,id_verification_status) VALUES(auth.uid(),'School ID',auth.uid()||'/missing.jpg','pending')$q$,'Upload your valid ID');
SELECT test_reject($q$INSERT INTO rider_verifications(user_id,id_type,id_document_path,id_verification_status) VALUES(auth.uid(),'Driver''s License',auth.uid()||'/old.jpg','pending')$q$,'Choose School ID');
RESET ROLE;
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('rider-ids','00000000-0000-0000-0000-000000000002/school.jpg'),
 ('rider-ids','00000000-0000-0000-0000-000000000002/national.pdf'),
 ('rider-ids','00000000-0000-0000-0000-000000000002/passport.png');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT test_reject($q$INSERT INTO rider_verifications(user_id,id_type,id_document_path,id_verification_status) VALUES(auth.uid(),'School ID',auth.uid()||'/school.jpg','approved')$q$,'row-level security');
INSERT INTO rider_verifications(user_id,id_type,id_document_path,id_verification_status) VALUES(auth.uid(),'School ID',auth.uid()||'/school.jpg','pending');
SELECT test_assert(has_rider_application_id(auth.uid()),'School ID eligible');
INSERT INTO rider_applications(id,user_id,full_name,phone,address,vehicle_type,license_number) VALUES('13000000-0000-4000-8000-000000000002',auth.uid(),'Test','09','Home','bicycle','Test');
UPDATE rider_verifications SET id_type='National ID',id_document_path=auth.uid()||'/national.pdf' WHERE user_id=auth.uid();
SELECT test_assert(has_rider_application_id(auth.uid()),'National ID eligible');
UPDATE rider_verifications SET id_type='Passport',id_document_path=auth.uid()||'/passport.png' WHERE user_id=auth.uid();
SELECT test_assert(has_rider_application_id(auth.uid()),'Passport eligible');
SELECT test_reject($q$UPDATE rider_verifications SET id_document_path='00000000-0000-0000-0000-000000000003/license.pdf' WHERE user_id=auth.uid()$q$,'Upload your valid ID');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
SELECT test_assert(count(*)=0,'unrelated customer cannot read IDs') FROM rider_verifications;
SELECT test_assert(NOT has_rider_application_id('00000000-0000-0000-0000-000000000002'),'cannot probe other user ID eligibility');
SELECT test_assert(count(*)=0,'unrelated user cannot view ID files') FROM storage.objects WHERE bucket_id='rider-ids';
SELECT test_reject($q$SELECT review_rider_application('13000000-0000-4000-8000-000000000002',true)$q$,'Forbidden');
RESET ROLE;
UPDATE rider_verifications SET id_verification_status='rejected' WHERE user_id='00000000-0000-0000-0000-000000000002';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT test_assert(count(*)=2,'admin can read IDs') FROM rider_verifications;
SELECT test_reject($q$SELECT review_rider_application('13000000-0000-4000-8000-000000000002',true)$q$,'Upload a School ID');
SELECT test_assert(NOT has_role('00000000-0000-0000-0000-000000000002','rider'),'failed approval grants no role');
SELECT test_assert(status='pending','failed approval preserves application') FROM rider_applications WHERE id='13000000-0000-4000-8000-000000000002';
RESET ROLE;
UPDATE rider_verifications SET id_verification_status='pending' WHERE user_id='00000000-0000-0000-0000-000000000002';
DELETE FROM storage.objects WHERE name='00000000-0000-0000-0000-000000000002/passport.png';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT test_reject($q$SELECT review_rider_application('13000000-0000-4000-8000-000000000002',true)$q$,'Upload a School ID');
SELECT review_rider_application('13000000-0000-4000-8000-000000000001',false);
RESET ROLE;
INSERT INTO storage.objects(bucket_id,name) VALUES ('rider-ids','00000000-0000-0000-0000-000000000002/passport.png');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT review_rider_application('13000000-0000-4000-8000-000000000002',true);
SELECT test_assert(has_role('00000000-0000-0000-0000-000000000002','rider'),'valid application approval grants role');
SET ROLE anon;
SELECT test_reject($q$SELECT has_rider_application_id('00000000-0000-0000-0000-000000000002')$q$,'permission denied');
RESET ROLE;
\echo 'Required rider ID SQL checks passed'
