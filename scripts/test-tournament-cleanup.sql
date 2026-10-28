\set ON_ERROR_STOP on
\ir test-tournament-streams.sql
\ir ../drizzle/migrations/0012_tournament_cleanup.sql
\ir ../drizzle/migrations/0012_tournament_cleanup.sql
-- Reusable synthetic events with real match graphs, history, contacts and prizes.
CREATE FUNCTION test_cleanup_event(event_title text,event_status text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE e uuid;m record;i integer;
BEGIN
 e:=save_pickleball_event_with_stream(NULL,event_title,'Cleanup fixture','Test courts',now()+interval '10 days',4,11,'double',false,'PHP',1000,
 '[{"title":"Champion","amount":1000,"placement":1}]',NULL,'{"platform":"youtube","status":"live","url":"https://youtu.be/abcdefghijk","replay_url":""}');
 FOR i IN 1..4 LOOP PERFORM manage_pickleball_team(e,NULL,'Team '||i,'First '||i,'Second '||i,'09000','approved','',false,NULL);END LOOP;
 IF event_status<>'registration' THEN
 PERFORM start_pickleball_tournament(e);
 LOOP
 SELECT * INTO m FROM pickleball_matches WHERE tournament_id=e AND state='ready' ORDER BY round_no,position LIMIT 1;
 EXIT WHEN NOT FOUND;PERFORM score_pickleball_match(m.id,11,9);
 EXIT WHEN event_status<>'completed';
 END LOOP;
 END IF;
 IF event_status='cancelled' THEN PERFORM cancel_pickleball_tournament(e); END IF;
 RETURN e;
END;$$;
-- Capture unrelated domains before cleanup.
CREATE TEMP TABLE unrelated_before AS SELECT 'orders' AS domain,to_jsonb(o) AS row FROM orders o
 UNION ALL SELECT 'order_items',to_jsonb(o) FROM order_items o
 UNION ALL SELECT 'court_bookings',to_jsonb(o) FROM court_bookings o
 UNION ALL SELECT 'pickleball_currencies',to_jsonb(o) FROM pickleball_currencies o
 UNION ALL SELECT 'user_roles',to_jsonb(o) FROM user_roles o;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
CREATE TEMP TABLE cleanup_targets AS SELECT test_cleanup_event('Cleanup '||s,s) AS id,s FROM unnest(ARRAY['registration','in_progress','completed','cancelled']) s;
SELECT test_assert(count(*)>0,'audit fixture exists') FROM pickleball_audit a JOIN cleanup_targets t ON a.tournament_id=t.id;
SELECT test_assert(count(*)=4,'final results fixture exists') FROM pickleball_results r JOIN cleanup_targets t ON r.tournament_id=t.id WHERE t.s='completed';
SELECT test_assert(count(*)=1,'assigned award fixture exists') FROM pickleball_awards a JOIN cleanup_targets t ON a.tournament_id=t.id WHERE t.s='completed';
SELECT jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision)) AS single_snapshot, max(e.title) AS single_title
FROM pickleball_tournaments e JOIN cleanup_targets t USING(id) WHERE t.s='completed' \gset
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,false,''wrong'')',:'single_snapshot'),'tournament name');
SELECT test_reject('SELECT admin_delete_pickleball_tournaments(''[]'',true,''DELETE ALL TOURNAMENTS'')','Choose tournaments');
SELECT test_reject('SELECT admin_delete_pickleball_tournaments(NULL,true,''DELETE ALL TOURNAMENTS'')','Choose tournaments');
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,NULL,%L)',:'single_snapshot',:'single_title'),'Choose tournaments');
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,false,%L)',jsonb_build_array(jsonb_build_object('id',(:'single_snapshot'::jsonb->0->>'id'))),:'single_title'),'Invalid tournament snapshot');
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,true,''DELETE ALL TOURNAMENTS'')',:'single_snapshot'::jsonb||:'single_snapshot'::jsonb),'Duplicate tournaments');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,false,%L)',:'single_snapshot',:'single_title'),'Admin access');
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,false,%L)',:'single_snapshot',:'single_title'),'Admin access');
SELECT test_reject('DELETE FROM pickleball_tournaments','permission denied');
RESET ROLE;
SET ROLE anon;
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,false,%L)',:'single_snapshot',:'single_title'),'permission denied');
RESET ROLE;
-- Preserve every other tournament row byte-for-byte when deleting one event.
CREATE TEMP TABLE other_events_before AS SELECT to_jsonb(e) AS row FROM pickleball_tournaments e WHERE e.id<>(:'single_snapshot'::jsonb->0->>'id')::uuid;
CREATE TEMP TABLE other_matches_before AS SELECT to_jsonb(m) AS row FROM pickleball_matches m WHERE m.tournament_id<>(:'single_snapshot'::jsonb->0->>'id')::uuid;
CREATE TEMP TABLE removed_teams AS SELECT id FROM pickleball_teams WHERE tournament_id=(:'single_snapshot'::jsonb->0->>'id')::uuid;
-- Force a late parent delete failure and prove all earlier child deletes roll back.
CREATE FUNCTION test_cleanup_fingerprint() RETURNS text LANGUAGE plpgsql AS $$
DECLARE tbl text;part text;result text:='';BEGIN
 FOREACH tbl IN ARRAY ARRAY['pickleball_tournaments','pickleball_teams','pickleball_team_contacts','pickleball_matches','pickleball_results','pickleball_prizes','pickleball_audit'] LOOP
 EXECUTE format($q$SELECT md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) FROM %I t$q$,tbl) INTO part;
 result:=result||tbl||part;
 END LOOP;RETURN md5(result);END;$$;
CREATE TABLE test_cleanup_guard(event_id uuid REFERENCES pickleball_tournaments(id));
INSERT INTO test_cleanup_guard VALUES((:'single_snapshot'::jsonb->0->>'id')::uuid);
SELECT test_cleanup_fingerprint() AS protected_fingerprint \gset
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,false,%L)',:'single_snapshot',:'single_title'),'violates foreign key constraint');
RESET ROLE;
SELECT test_assert(test_cleanup_fingerprint()=:'protected_fingerprint','late failure rolls back every child delete');
DROP TABLE test_cleanup_guard;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
-- A caller's temporary table must never shadow the permanent target.
CREATE TEMP TABLE pickleball_tournaments AS SELECT * FROM public.pickleball_tournaments WHERE id=(:'single_snapshot'::jsonb->0->>'id')::uuid;
SELECT test_assert(admin_delete_pickleball_tournaments(:'single_snapshot',false,:'single_title')=1,'delete completed tournament');
SELECT test_assert(count(*)=1,'caller temporary table untouched') FROM pg_temp.pickleball_tournaments;
DROP TABLE pg_temp.pickleball_tournaments;
RESET ROLE;
SELECT test_assert(NOT EXISTS(SELECT * FROM other_events_before EXCEPT SELECT to_jsonb(e) FROM pickleball_tournaments e),'other events preserved');
SELECT test_assert(NOT EXISTS(SELECT * FROM other_matches_before EXCEPT SELECT to_jsonb(m) FROM pickleball_matches m),'other match graphs preserved');
SELECT test_assert(NOT EXISTS(SELECT 1 FROM pickleball_team_contacts WHERE team_id IN(SELECT id FROM removed_teams)),'private contacts deleted');
DO $$ DECLARE tbl text;BEGIN
 FOREACH tbl IN ARRAY ARRAY['pickleball_teams','pickleball_matches','pickleball_results','pickleball_prizes','pickleball_audit'] LOOP
 EXECUTE format('SELECT test_assert(NOT EXISTS(SELECT 1 FROM %I WHERE tournament_id=(SELECT id FROM cleanup_targets WHERE s=''completed'')),%L)',tbl,tbl||' removed');
 END LOOP;
END;$$;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,false,%L)',:'single_snapshot',:'single_title'),'changed');
-- Deleted/changed/added events cannot slip into bulk confirmation.
SELECT jsonb_agg(jsonb_build_object('id',id,'revision',revision)) AS all_snapshot FROM pickleball_tournaments \gset
SELECT cancel_pickleball_tournament(id) FROM cleanup_targets WHERE s='registration';
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,true,''DELETE ALL TOURNAMENTS'')',:'all_snapshot'),'changed');
SELECT jsonb_agg(jsonb_build_object('id',id,'revision',revision)) AS all_snapshot FROM pickleball_tournaments \gset
SELECT test_cleanup_event('Created after confirmation','registration') AS later_event \gset
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,true,''DELETE ALL TOURNAMENTS'')',:'all_snapshot'),'changed');
-- Single-event deletion works with populated active graphs too.
SELECT jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision)) AS active_snapshot FROM pickleball_tournaments e JOIN cleanup_targets t USING(id) WHERE t.s='in_progress' \gset
SELECT test_assert(admin_delete_pickleball_tournaments(:'active_snapshot',false,'Cleanup in_progress')=1,'delete active graph');
SELECT jsonb_agg(jsonb_build_object('id',id,'revision',revision)) AS all_snapshot, count(*) AS all_count FROM pickleball_tournaments \gset
SELECT test_reject(format('SELECT admin_delete_pickleball_tournaments(%L,true,''wrong'')',:'all_snapshot'),'DELETE ALL TOURNAMENTS');
SELECT test_assert(admin_delete_pickleball_tournaments(:'all_snapshot',true,'DELETE ALL TOURNAMENTS')=:all_count,'bulk deletion returns exact count');
RESET ROLE;
DO $$ DECLARE tbl text;n integer;BEGIN
 FOREACH tbl IN ARRAY ARRAY['pickleball_tournaments','pickleball_teams','pickleball_team_contacts','pickleball_matches','pickleball_results','pickleball_prizes','pickleball_audit'] LOOP
 EXECUTE format('SELECT count(*) FROM %I',tbl) INTO n;PERFORM test_assert(n=0,tbl||' fully cleared');
 END LOOP;
END;$$;
SELECT test_assert(NOT EXISTS(SELECT * FROM unrelated_before EXCEPT
 (SELECT 'orders',to_jsonb(o) FROM orders o UNION ALL SELECT 'order_items',to_jsonb(o) FROM order_items o
 UNION ALL SELECT 'court_bookings',to_jsonb(o) FROM court_bookings o UNION ALL SELECT 'pickleball_currencies',to_jsonb(o) FROM pickleball_currencies o
 UNION ALL SELECT 'user_roles',to_jsonb(o) FROM user_roles o)),'unrelated domains untouched');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT test_assert(test_cleanup_event('Fresh start','registration') IS NOT NULL,'can create tournaments after cleanup');
RESET ROLE;
\echo 'Tournament cleanup checks passed'
