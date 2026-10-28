\set ON_ERROR_STOP on
\ir test-tournaments.sql
\ir ../drizzle/migrations/0010_advanced_tournaments.sql
\ir ../drizzle/migrations/0011_tournament_livestreams.sql
SELECT test_assert(bool_and(livestream->>'platform'='none'),'legacy events have no broadcast') FROM pickleball_tournaments;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT save_pickleball_event_with_stream(NULL,'Broadcast Cup','','Test courts',now()+interval '10 days',2,11,'double',false,'PHP',1000,
 '[{"title":"Champion","amount":1000,"placement":1}]',NULL,
 '{"platform":"youtube","status":"scheduled","url":"https://youtu.be/abcdefghijk?si=token","replay_url":""}') AS stream_event \gset
SELECT test_assert(livestream->>'status'='scheduled','broadcast saved with event') FROM pickleball_tournaments WHERE id=:'stream_event';
SELECT test_assert(count(*)=1,'prizes saved atomically') FROM pickleball_prizes WHERE tournament_id=:'stream_event';
SELECT test_reject($q$SELECT save_pickleball_event_with_stream(NULL,'Invalid Broadcast','','Test',now()+interval '10 days',2,11,'double',false,'PHP',NULL,'[]',NULL,'{"platform":"youtube","status":"live","url":"https://youtube.com.evil.test/watch?v=abcdefghijk","replay_url":""}')$q$,'Invalid livestream');
SELECT test_assert(count(*)=0,'invalid broadcast did not create event') FROM pickleball_tournaments WHERE title='Invalid Broadcast';
DO $$ DECLARE cfg jsonb;u text;BEGIN
 FOREACH u IN ARRAY ARRAY['javascript:alert(1)','http://youtu.be/abcdefghijk','https://user:pass@youtube.com/watch?v=abcdefghijk','https://www.youtube.com/@channel/live','https://www.youtube.com/watch?v=short'] LOOP
 PERFORM test_assert(NOT pickleball_valid_video_url('youtube',u),'unsafe URL rejected');END LOOP;
 PERFORM test_assert(pickleball_valid_video_url('youtube','https://www.youtube.com/live/abcdefghijk?feature=share'),'youtube live URL');
 PERFORM test_assert(pickleball_valid_video_url('youtube','https://www.youtube.com/watch?v=abcdefghijk&t=10'),'youtube watch URL');
 PERFORM test_assert(pickleball_valid_video_url('facebook','https://www.facebook.com/Roadside/videos/123456789/'),'Facebook video');
 PERFORM test_assert(pickleball_valid_video_url('facebook','https://www.facebook.com/watch/?v=123456789'),'Facebook watch');
 PERFORM test_assert(pickleball_valid_video_url('facebook','https://www.facebook.com/share/v/Abc123/'),'Facebook share');
 PERFORM test_assert(NOT pickleball_valid_stream('{"platform":"youtube","status":"bad","url":"https://youtu.be/abcdefghijk","replay_url":""}'),'invalid status');
 PERFORM test_assert(NOT pickleball_valid_stream('{"platform":"facebook","status":"live","url":"https://youtu.be/abcdefghijk","replay_url":""}'),'platform mismatch');
 PERFORM test_assert(NOT pickleball_valid_stream('{"platform":"youtube","status":"ended","url":"https://youtu.be/abcdefghijk","replay_url":"https://evil.test"}'),'unsafe replay');
 PERFORM test_assert(NOT pickleball_valid_stream('{}'),'missing fields');
END;$$;
SELECT revision AS stream_rev FROM pickleball_tournaments WHERE id=:'stream_event' \gset
SELECT save_pickleball_event_with_stream(:'stream_event','Broadcast Cup','','Test courts',now()+interval '10 days',2,11,'double',false,'PHP',NULL,'[]',:stream_rev,
 '{"platform":"facebook","status":"live","url":"https://www.facebook.com/Roadside/videos/123456789/","replay_url":""}');
SELECT test_reject(format($q$SELECT save_pickleball_event_with_stream(%L,'Stale','','Test',now()+interval '10 days',2,11,'double',false,'PHP',NULL,'[]',%s,'{"platform":"none","status":"scheduled","url":"","replay_url":""}')$q$,:'stream_event',:stream_rev),'changed');
SELECT test_assert(title='Broadcast Cup' AND livestream->>'platform'='facebook','stale save preserves event and stream') FROM pickleball_tournaments WHERE id=:'stream_event';
SELECT manage_pickleball_team(:'stream_event',NULL,'Team One','Alice','Ben','09000','approved','',false,NULL);
SELECT manage_pickleball_team(:'stream_event',NULL,'Team Two','Carol','Dan','09000','approved','',false,NULL);
SELECT start_pickleball_tournament(:'stream_event');
DO $$ DECLARE m record;BEGIN LOOP
 SELECT * INTO m FROM pickleball_matches WHERE tournament_id=(SELECT id FROM pickleball_tournaments WHERE title='Broadcast Cup') AND state='ready' LIMIT 1;
 EXIT WHEN NOT FOUND;PERFORM score_pickleball_match(m.id,11,9);END LOOP;END;$$;
SELECT revision AS stream_rev FROM pickleball_tournaments WHERE id=:'stream_event' \gset
SELECT save_pickleball_event_with_stream(:'stream_event','Broadcast Cup','','Test courts',now()+interval '10 days',2,11,'double',false,'PHP',NULL,'[]',:stream_rev,
 '{"platform":"youtube","status":"ended","url":"https://youtu.be/abcdefghijk","replay_url":"https://youtu.be/12345678901"}');
SELECT test_assert(status='completed' AND livestream->>'status'='ended','broadcast editable after completion') FROM pickleball_tournaments WHERE id=:'stream_event';
SELECT revision AS stream_rev FROM pickleball_tournaments WHERE id=:'stream_event' \gset
-- Existing RPC callers do not erase stream settings.
SELECT save_pickleball_event(:'stream_event','Broadcast Cup','','Test courts',now()+interval '10 days',2,11,'double',false,'PHP',NULL,'[]',:stream_rev);
SELECT test_assert(livestream->>'replay_url'='https://youtu.be/12345678901','legacy RPC preserves stream') FROM pickleball_tournaments WHERE id=:'stream_event';
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
SELECT test_reject(format($q$SELECT save_pickleball_event_with_stream(%L,'Hijack','','Test',now(),2,11,'double',false,'PHP',NULL,'[]',NULL,'{"platform":"none","status":"scheduled","url":"","replay_url":""}')$q$,:'stream_event'),'Admin access');
SELECT test_reject(format('UPDATE pickleball_tournaments SET livestream=''{}'' WHERE id=%L',:'stream_event'),'permission denied');
RESET ROLE;
SET ROLE anon;
SELECT test_assert(livestream->>'status'='ended','public can view coverage') FROM pickleball_tournaments WHERE id=:'stream_event';
SELECT test_reject($q$SELECT save_pickleball_event_with_stream(NULL,'Anon','','Test',now(),2,11,'double',false,'PHP',NULL,'[]',NULL,'{}')$q$,'permission denied');
RESET ROLE;
CREATE TEMP TABLE streams_before AS SELECT id,livestream,revision FROM pickleball_tournaments;
\ir ../drizzle/migrations/0011_tournament_livestreams.sql
SELECT test_assert(NOT EXISTS(SELECT * FROM streams_before EXCEPT SELECT id,livestream,revision FROM pickleball_tournaments),'reapplication preserves configuration and revision');
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
SELECT revision AS stream_rev FROM pickleball_tournaments WHERE id=:'stream_event' \gset
SELECT save_pickleball_event_with_stream(:'stream_event','Broadcast Cup','','Test courts',now()+interval '10 days',2,11,'double',false,'PHP',NULL,'[]',:stream_rev,
 '{"platform":"none","status":"scheduled","url":"","replay_url":""}');
SELECT test_assert(livestream->>'platform'='none','admin can remove broadcast') FROM pickleball_tournaments WHERE id=:'stream_event';
RESET ROLE;
\echo 'Tournament livestream checks passed'
