\set ON_ERROR_STOP on
-- Empty disposable database only. Reuse the Supabase auth/storage scaffold and
-- baseline migration checks; all fixtures are synthetic.
\ir test-order-types.sql
\ir ../drizzle/migrations/0008_pickleball_tournaments.sql

INSERT INTO auth.users(id)
SELECT ('20000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid FROM generate_series(1,32) i;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT save_pickleball_tournament('Weekend doubles', 'All levels', 'Test courts', now() + interval '10 days', 3, 11) AS event_id \gset
SELECT test_reject($q$SELECT save_pickleball_tournament('Bad event', '', 'Test', now() - interval '1 day', 8, 11)$q$, 'future start');
SELECT test_reject($q$SELECT save_pickleball_tournament('Bad event', '', 'Test', now() + interval '1 day', 33, 11)$q$, 'check constraint');
SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
SELECT register_pickleball_team(:'event_id', 'First team', 'Player one', 'Player two', '09001') AS team_id \gset
SELECT test_reject(format('SELECT register_pickleball_team(%L, ''Duplicate'', ''One'', ''Two'', ''09001'')', :'event_id'), 'already registered');
SELECT test_reject(format('SELECT start_pickleball_tournament(%L)', :'event_id'), 'Admin access');
SELECT test_reject(format('SELECT cancel_pickleball_tournament(%L)', :'event_id'), 'Admin access');
SELECT test_reject($q$SELECT save_pickleball_tournament('Not allowed', '', 'Test', now() + interval '1 day', 8, 11)$q$, 'Admin access');
SELECT test_assert(count(*) = 1, 'captain can read own contact') FROM pickleball_team_contacts;
SELECT test_reject(format('UPDATE pickleball_teams SET name = ''Hijack'' WHERE id = %L', :'team_id'), 'permission denied');
SELECT test_reject(format('SELECT advance_pickleball_winner(%L)', gen_random_uuid()), 'permission denied');
SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000002';
SELECT test_assert(count(*) = 0, 'another entrant cannot read contact') FROM pickleball_team_contacts;
SELECT test_reject(format('SELECT withdraw_pickleball_team(%L)', :'team_id'), 'cannot remove');
SELECT test_reject(format('SELECT register_pickleball_team(%L, ''first TEAM'', ''One'', ''Two'', ''09002'')', :'event_id'), 'already registered');
SELECT register_pickleball_team(:'event_id', 'Second team', 'Player three', 'Player four', '09002') AS second_id \gset
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT test_assert(count(*) = 2, 'admin can read contacts') FROM pickleball_team_contacts;
SELECT test_reject(format('SELECT save_pickleball_tournament(''Capacity test'', '''', ''Test'', now() + interval ''2 days'', 1, 11, %L)', :'event_id'), 'Capacity cannot');
SELECT withdraw_pickleball_team(:'second_id');
SELECT test_assert(count(*) = 1, 'admin removal also cleans contact') FROM pickleball_team_contacts;
SET request.jwt.claim.sub = '20000000-0000-0000-0000-000000000001';
SELECT withdraw_pickleball_team(:'team_id');
SELECT test_assert(count(*) = 0, 'captain can withdraw before draw') FROM pickleball_teams;
RESET ROLE;
SET ROLE anon;
SELECT test_assert(count(*) = 1, 'public can view events') FROM pickleball_tournaments;
SELECT test_reject($q$SELECT * FROM pickleball_team_contacts$q$, 'permission denied');
SELECT test_reject($q$SELECT register_pickleball_team(gen_random_uuid(), 'Anon', 'One', 'Two', '09000')$q$, 'permission denied');
RESET ROLE;
SET ROLE authenticated;

-- Exercise every supported bracket size, including non-power-of-two fields.
DO $$
DECLARE n integer; i integer; event_id uuid; team_id uuid; match_row record; event_status text; bracket_size integer; played integer;
BEGIN
  FOR n IN 2..32 LOOP
    PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    event_id := save_pickleball_tournament('Draw ' || n, '', 'Test courts', now() + interval '10 days', n, 11);
    FOR i IN 1..n LOOP
      PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-' || lpad(i::text,12,'0'),false);
      team_id := register_pickleball_team(event_id, 'Team ' || i, 'First player ' || i, 'Second player ' || i, '09000');
    END LOOP;
    PERFORM test_reject(format('SELECT register_pickleball_team(%L, ''Overflow'', ''One'', ''Two'', ''09000'')',event_id), 'Tournament is full');
    PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
    PERFORM start_pickleball_tournament(event_id);
    bracket_size := 2;
    WHILE bracket_size < n LOOP bracket_size := bracket_size * 2; END LOOP;
    PERFORM test_assert((SELECT count(*) = bracket_size - 1 FROM pickleball_matches WHERE tournament_id = event_id), 'full bracket created');
    PERFORM test_assert((SELECT count(*) = bracket_size - n FROM pickleball_matches WHERE tournament_id = event_id AND state = 'bye'), 'correct number of byes');
    PERFORM test_reject(format('SELECT start_pickleball_tournament(%L)',event_id), 'already started');
    PERFORM test_reject(format('SELECT withdraw_pickleball_team(%L)',team_id), 'draw is locked');
    PERFORM test_reject(format('SELECT register_pickleball_team(%L, ''Late'', ''One'', ''Two'', ''09000'')',event_id), 'Registration is closed');
    played := 0;
    LOOP
      SELECT * INTO match_row FROM pickleball_matches WHERE tournament_id = event_id AND state = 'ready' ORDER BY round_no, position LIMIT 1;
      EXIT WHEN NOT FOUND;
      IF played = 0 THEN
        PERFORM set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',false);
        PERFORM test_reject(format('SELECT score_pickleball_match(%L,11,9)',match_row.id), 'Admin access');
        PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
        PERFORM test_reject(format('SELECT score_pickleball_match(%L,11,11)',match_row.id), 'win by at least two');
        PERFORM test_reject(format('SELECT score_pickleball_match(%L,10,8)',match_row.id), 'target score');
        PERFORM schedule_pickleball_match(match_row.id, 'Court 1', now() + interval '10 days');
        PERFORM test_assert((SELECT court = 'Court 1' AND scheduled_at IS NOT NULL FROM pickleball_matches WHERE id = match_row.id), 'schedule persisted');
      END IF;
      -- Alternate winning side and include deuce scores.
      IF played % 2 = 0 THEN PERFORM score_pickleball_match(match_row.id,11,9);
      ELSE PERFORM score_pickleball_match(match_row.id,12,14); END IF;
      PERFORM test_reject(format('SELECT score_pickleball_match(%L,11,9)',match_row.id), 'not ready');
      played := played + 1;
      IF played > n THEN RAISE EXCEPTION 'Bracket failed to terminate'; END IF;
    END LOOP;
    SELECT status INTO event_status FROM pickleball_tournaments WHERE id = event_id;
    PERFORM test_assert(event_status = 'completed' AND played = n - 1, 'one champion after n-1 played matches');
    PERFORM test_assert((SELECT count(*) = 0 FROM pickleball_matches WHERE tournament_id = event_id AND state IN ('waiting','ready')), 'no stranded matches');
    PERFORM test_assert((SELECT winner_id IS NOT NULL FROM pickleball_matches WHERE tournament_id = event_id ORDER BY round_no DESC LIMIT 1), 'final champion recorded');
  END LOOP;
END; $$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT cancel_pickleball_tournament(:'event_id');
SELECT test_reject(format('SELECT start_pickleball_tournament(%L)', :'event_id'), 'already started');
SELECT test_reject(format('SELECT register_pickleball_team(%L, ''Closed team'', ''One'', ''Two'', ''09000'')', :'event_id'), 'Registration is closed');
SELECT test_reject(format('SELECT save_pickleball_tournament(''Closed event'', '''', ''Test'', now() + interval ''2 days'', 3, 11, %L)', :'event_id'), 'Only events accepting');
RESET ROLE;
\echo 'Tournament SQL integration checks passed for all 31 field sizes'
