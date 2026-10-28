\set ON_ERROR_STOP on
\ir test-tournaments.sql
\ir ../drizzle/migrations/0010_advanced_tournaments.sql
SELECT test_assert(count(*)=31,'legacy completed events preserved') FROM pickleball_tournaments WHERE status='completed';
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$
DECLARE n integer;i integer;mode integer;e uuid;m record;played integer;rev integer;
BEGIN
 FOR mode IN 0..1 LOOP
 FOR n IN 2..32 LOOP
 e:=save_pickleball_event(NULL,'Double '||n,'','Test courts',now()+interval '10 days',n,11,'double',false,'PHP',1000,
 '[{"title":"Champion","amount":700,"placement":1},{"title":"Runner-up","amount":300,"placement":2},{"title":"Spirit award","non_cash_reward":"Medal"}]',NULL);
 FOR i IN 1..n LOOP
 PERFORM manage_pickleball_team(e,NULL,'Team '||i,'First '||i,'Second '||i,'09000','approved','',false,NULL);
 END LOOP;
 PERFORM start_pickleball_tournament(e);
 played:=0;
 LOOP
 SELECT * INTO m FROM pickleball_matches WHERE tournament_id=e AND state='ready' ORDER BY bracket DESC,round_no,position LIMIT 1;
 EXIT WHEN NOT FOUND;
 IF m.bracket='championship' AND m.round_no=1 AND mode=1 THEN PERFORM score_pickleball_match(m.id,9,11);
 ELSE PERFORM score_pickleball_match(m.id,11,9); END IF;
 played:=played+1;
 IF played>2*n THEN RAISE EXCEPTION 'Non-terminating draw';END IF;
 END LOOP;
 PERFORM test_assert((SELECT status='completed' FROM pickleball_tournaments WHERE id=e),'double completed');
 PERFORM test_assert(played=2*n-2+mode,'double match count including reset');
 PERFORM test_assert((SELECT count(*)=n FROM pickleball_results WHERE tournament_id=e),'every team placed');
 PERFORM test_assert((SELECT count(*)=2 FROM pickleball_awards WHERE tournament_id=e),'automatic awards');
 PERFORM test_assert(NOT EXISTS(SELECT 1 FROM pickleball_matches WHERE tournament_id=e AND state IN('ready','waiting')),'no stranded matches');
 -- A completed final can only be corrected with explicit confirmation.
 SELECT * INTO m FROM pickleball_matches WHERE tournament_id=e AND bracket='championship' AND state='completed' ORDER BY round_no DESC LIMIT 1;
 SELECT revision INTO rev FROM pickleball_tournaments WHERE id=e;
 PERFORM test_reject(format('SELECT admin_record_pickleball_result(%L,11,9,true,''Correction'',false,%s)',m.id,rev),'Confirm resetting');
 PERFORM admin_record_pickleball_result(m.id,NULL,NULL,true,'Score correction',true,rev);
 PERFORM test_assert((SELECT status='in_progress' FROM pickleball_tournaments WHERE id=e),'correction reopens event');
 PERFORM test_assert((SELECT count(*)=0 FROM pickleball_awards WHERE tournament_id=e),'awards withdrawn until results reconfirmed');
 PERFORM test_assert(EXISTS(SELECT 1 FROM pickleball_audit WHERE tournament_id=e AND before_data->>'state'='completed'),'history preserved');
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''PHP'',NULL,''[]'',%s)',e,rev),'changed');
 END LOOP;END LOOP;
END; $$;
RESET ROLE;
\echo 'Advanced brackets: every field size and both championship paths passed'
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $$
DECLARE e uuid;other uuid;ta uuid;tb uuid;tc uuid;td uuid;w1 uuid;w2 uuid;wf uuid;lf uuid;m record;rev integer;original uuid;before_count integer;
BEGIN
 e:=save_pickleball_event(NULL,'Controls Cup','','Test',now()+interval '10 days',8,11,'double',true,'PHP',1000,'[]',NULL);
 PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
 ta:=register_pickleball_team(e,'Pending team','Player A','Player B','09000');
 PERFORM test_assert((SELECT registration_status='pending' FROM pickleball_teams WHERE id=ta),'registration needs approval');
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''PHP'',NULL,''[]'',NULL)',e),'Admin access');
 PERFORM test_reject(format('SELECT manage_pickleball_team(%L,NULL,''Hijack'',''One'',''Two'',''09000'',''approved'','''',false,NULL)',e),'Admin access');
 PERFORM test_reject(format('SELECT pickleball_reconcile(%L)',e),'permission denied');
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
 PERFORM manage_pickleball_team(e,ta,'Approved team','Player A','Player B','09000','approved','Approved',false,NULL);
 tb:=manage_pickleball_team(e,NULL,'Admin team B','Player C','Player D','09001','approved','',false,NULL);
 tc:=manage_pickleball_team(e,NULL,'Admin team C','Player E','Player F','09002','approved','',false,NULL);
 td:=manage_pickleball_team(e,NULL,'Admin team D','Player G','Player H','09003','approved','',false,NULL);
 PERFORM save_pickleball_prizes(e,'PHP',1000,jsonb_build_array(
 jsonb_build_object('title','Champion','amount',700,'placement',1),
 jsonb_build_object('title','MVP','recipient_team_id',ta,'recipient_player','Player A','non_cash_reward','Paddle'),
 jsonb_build_object('title','Special award','description','Community spirit')),NULL);
 PERFORM manage_pickleball_team(e,ta,'Renamed team','Renamed player','Player B','09000','approved','Name correction',false,NULL);
 PERFORM test_assert((SELECT recipient_player='Renamed player' FROM pickleball_prizes WHERE tournament_id=e AND title='MVP'),'player award name synchronized');
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''PHP'',NULL,''[{"title":"Bad","amount":-1}]'',NULL)',e),'Invalid prize amount');
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''PHP'',NULL,''[{"title":"Bad","amount":1.001}]'',NULL)',e),'decimal places');
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''JPY'',NULL,''[{"title":"Bad","amount":1.1}]'',NULL)',e),'decimal places');
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''XYZ'',NULL,''[]'',NULL)',e),'supported currency');
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''PHP'',NULL,''[{"title":"Bad","amount":"NaN"}]'',NULL)',e),'Invalid prize amount');
 PERFORM test_assert((SELECT count(*)=3 FROM pickleball_prizes WHERE tournament_id=e),'failed save preserves previous awards');
 PERFORM start_pickleball_tournament(e);
 SELECT id,team_a_id INTO w1,original FROM pickleball_matches WHERE tournament_id=e AND bracket='winners' AND round_no=1 AND position=1;
 SELECT id INTO w2 FROM pickleball_matches WHERE tournament_id=e AND bracket='winners' AND round_no=1 AND position=2;
 SELECT id INTO wf FROM pickleball_matches WHERE tournament_id=e AND bracket='winners' AND round_no=2;
 SELECT id INTO lf FROM pickleball_matches WHERE tournament_id=e AND bracket='losers' AND round_no=1;
 PERFORM test_reject(format('SELECT move_pickleball_slot(%L,''a'',%L,''a'',''Cycle test'',true,NULL)',w1,wf),'cycle');
 PERFORM test_assert((SELECT team_a_id=original FROM pickleball_matches WHERE id=w1),'invalid move rolled back');
 PERFORM move_pickleball_slot(w1,'a',w2,'a','Seed correction',true,NULL);
 PERFORM test_assert((SELECT team_a_id=original FROM pickleball_matches WHERE id=w2),'seed swap applied');
 PERFORM score_pickleball_match(w1,11,9);
 PERFORM score_pickleball_match(w2,11,9);
 -- Move winners and losers between paths without duplicating a source.
 PERFORM move_pickleball_slot(wf,'a',lf,'a','Cross bracket correction',true,NULL);
 PERFORM test_assert((SELECT source_a_outcome='loser' FROM pickleball_matches WHERE id=wf),'winner slot receives loser path');
 PERFORM move_pickleball_slot(wf,'a',lf,'a','Restore original paths',true,NULL);
 PERFORM test_reject(format('SELECT admin_record_pickleball_result(%L,9,11,false,''Correction'',NULL,NULL)',w1),'Confirm resetting');
 PERFORM admin_record_pickleball_result(w1,9,11,false,'Reverse winning team',true,NULL);
 PERFORM test_assert((SELECT state='completed' FROM pickleball_matches WHERE id=w2),'unrelated result preserved');
 LOOP
 SELECT * INTO m FROM pickleball_matches WHERE tournament_id=e AND state='ready' LIMIT 1;
 EXIT WHEN NOT FOUND;
 PERFORM score_pickleball_match(m.id,11,9);
 END LOOP;
 PERFORM test_assert((SELECT status='completed' FROM pickleball_tournaments WHERE id=e),'corrected bracket completed');
 PERFORM test_assert((SELECT count(*)=2 FROM pickleball_awards WHERE tournament_id=e),'placement and manual player awards assigned');
 PERFORM save_pickleball_prizes(e,'KWD',20.125,'[{"title":"New post-event award","amount":20.125,"placement":1,"non_cash_reward":"Trophy"}]',NULL);
 PERFORM test_assert((SELECT count(*)=1 AND min(amount)=20.125 FROM pickleball_awards WHERE tournament_id=e),'post-completion edit updates assigned awards');
 PERFORM save_pickleball_prizes(e,'JPY',1000,'[{"title":"JPY award","amount":1000,"placement":2}]',NULL);
 PERFORM test_assert((SELECT currency='JPY' FROM pickleball_awards WHERE tournament_id=e),'zero decimal currency accepted');
 PERFORM save_pickleball_prizes(e,'PHP',NULL,'[]',NULL);
 PERFORM test_assert((SELECT count(*)=0 FROM pickleball_awards WHERE tournament_id=e),'prize removal synchronized');
 -- In-progress withdrawal resets the affected path and retains history.
 SELECT revision INTO rev FROM pickleball_tournaments WHERE id=e;
 SELECT count(*) INTO before_count FROM pickleball_audit WHERE tournament_id=e;
 PERFORM manage_pickleball_team(e,ta,'Renamed team','Renamed player','Player B','09000','withdrawn','Team unable to continue',true,rev);
 PERFORM test_assert((SELECT count(*)>before_count FROM pickleball_audit WHERE tournament_id=e),'withdrawal retains prior match history');
 LOOP
 SELECT * INTO m FROM pickleball_matches WHERE tournament_id=e AND state='ready' LIMIT 1;
 EXIT WHEN NOT FOUND;
 PERFORM score_pickleball_match(m.id,11,9);
 END LOOP;
 PERFORM test_assert((SELECT status='withdrawn' AND placement IS NULL FROM pickleball_results WHERE team_id=ta),'withdrawn team has explicit final status');
 other:=save_pickleball_event(NULL,'Other event','','Test',now()+interval '10 days',8,11,'double',false,'PHP',NULL,'[]',NULL);
 PERFORM test_reject(format('SELECT save_pickleball_prizes(%L,''PHP'',NULL,%L,NULL)',other,jsonb_build_array(jsonb_build_object('title','Cross event','recipient_team_id',ta))::text),'participating team');
 -- Removing a pre-draw registration also clears custom award assignment.
 ta:=manage_pickleball_team(other,NULL,'Removed team','One player','Two player','09000','approved','',false,NULL);
 PERFORM save_pickleball_prizes(other,'PHP',NULL,jsonb_build_array(jsonb_build_object('title','Custom','recipient_team_id',ta)),NULL);
 PERFORM withdraw_pickleball_team(ta);
 PERFORM test_assert((SELECT recipient_team_id IS NULL FROM pickleball_prizes WHERE tournament_id=other),'removed team unassigned safely');
END; $$;
RESET ROLE;
SET ROLE anon;
SELECT test_assert(count(*)>0,'public prizes readable') FROM pickleball_prizes;
SELECT test_assert(count(*)>0,'public standings readable') FROM pickleball_results;
SELECT test_reject('SELECT * FROM pickleball_audit','permission denied');
SELECT test_reject('SELECT save_pickleball_prizes(gen_random_uuid(),''PHP'',NULL,''[]'',NULL)','permission denied');
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub='20000000-0000-0000-0000-000000000001';
SELECT test_assert(count(*)=0,'ordinary user cannot read admin history') FROM pickleball_audit;
SELECT test_reject('UPDATE pickleball_prizes SET amount=1','permission denied');
SELECT test_reject('DELETE FROM pickleball_results','permission denied');
RESET ROLE;
\echo 'Advanced permissions, prizes, corrections, placements and registration passed'
-- Reapplication must preserve populated draws, prize configuration and audit records.
CREATE TEMP TABLE saved_matches AS SELECT * FROM pickleball_matches;
CREATE TEMP TABLE saved_prizes AS SELECT * FROM pickleball_prizes;
CREATE TEMP TABLE saved_history AS SELECT * FROM pickleball_audit;
\ir ../drizzle/migrations/0010_advanced_tournaments.sql
SELECT test_assert(NOT EXISTS(
 (SELECT * FROM saved_matches EXCEPT SELECT * FROM pickleball_matches)
 UNION ALL (SELECT * FROM pickleball_matches EXCEPT SELECT * FROM saved_matches)
),'migration reapplication preserves match records and manual bindings');
SELECT test_assert(NOT EXISTS(
 (SELECT * FROM saved_prizes EXCEPT SELECT * FROM pickleball_prizes)
 UNION ALL (SELECT * FROM pickleball_prizes EXCEPT SELECT * FROM saved_prizes)
),'migration reapplication preserves prizes');
SELECT test_assert(NOT EXISTS(
 (SELECT * FROM saved_history EXCEPT SELECT * FROM pickleball_audit)
 UNION ALL (SELECT * FROM pickleball_audit EXCEPT SELECT * FROM saved_history)
),'migration reapplication preserves history');
\echo 'Advanced migration reapplication passed'
