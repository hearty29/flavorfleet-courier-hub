BEGIN;

-- Roadside Paddles Leaderboard: open-play sessions, player queue and match results.
-- Everyone can read; all writes go through the security-definer functions below.

CREATE TABLE public.open_play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  venue text NOT NULL DEFAULT '' CHECK (char_length(venue) <= 200),
  played_on date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.open_play_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.open_play_sessions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  queue_status text NOT NULL DEFAULT 'waiting' CHECK (queue_status IN ('waiting', 'playing', 'away')),
  queued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX open_play_player_names ON public.open_play_players (session_id, lower(btrim(name)));
CREATE UNIQUE INDEX open_play_player_users ON public.open_play_players (session_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX open_play_queue_order ON public.open_play_players (session_id, queue_status, queued_at);

CREATE TABLE public.open_play_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.open_play_sessions(id) ON DELETE CASCADE,
  court text NOT NULL CHECK (char_length(btrim(court)) BETWEEN 1 AND 100),
  team_a uuid[] NOT NULL,
  team_b uuid[] NOT NULL,
  score_a integer CHECK (score_a BETWEEN 0 AND 99),
  score_b integer CHECK (score_b BETWEEN 0 AND 99),
  state text NOT NULL DEFAULT 'playing' CHECK (state IN ('playing', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (cardinality(team_a) BETWEEN 1 AND 2 AND cardinality(team_a) = cardinality(team_b)),
  CHECK ((state = 'completed') = (score_a IS NOT NULL AND score_b IS NOT NULL)),
  CHECK (score_a IS NULL OR score_b IS NULL OR score_a <> score_b)
);
CREATE UNIQUE INDEX open_play_one_active_match_per_court ON public.open_play_matches (session_id, court) WHERE state = 'playing';
CREATE INDEX open_play_matches_session ON public.open_play_matches (session_id, created_at);

ALTER TABLE public.open_play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_play_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_play_matches ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.open_play_sessions, public.open_play_players, public.open_play_matches TO anon, authenticated;
GRANT ALL ON public.open_play_sessions, public.open_play_players, public.open_play_matches TO service_role;

CREATE POLICY open_play_sessions_public ON public.open_play_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY open_play_players_public ON public.open_play_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY open_play_matches_public ON public.open_play_matches FOR SELECT TO anon, authenticated USING (true);

-- Sessions ---------------------------------------------------------------

CREATE FUNCTION public.open_play_create_session(_title text, _venue text, _played_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create sessions' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.open_play_sessions (title, venue, played_on, created_by)
  VALUES (btrim(_title), btrim(coalesce(_venue, '')), coalesce(_played_on, current_date), auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE FUNCTION public.open_play_set_session_status(_session uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change sessions' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('open', 'closed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF _status = 'closed' AND EXISTS (
    SELECT 1 FROM public.open_play_matches WHERE session_id = _session AND state = 'playing'
  ) THEN
    RAISE EXCEPTION 'Finish or cancel the matches in progress first';
  END IF;
  UPDATE public.open_play_sessions SET status = _status WHERE id = _session;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
END $$;

-- Queue ------------------------------------------------------------------

CREATE FUNCTION public.open_play_add_player(_session uuid, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _clean text := btrim(coalesce(_name, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can add players' USING ERRCODE = '42501';
  END IF;
  IF char_length(_clean) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Enter a player name (up to 60 characters)'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.open_play_sessions WHERE id = _session AND status = 'open') THEN
    RAISE EXCEPTION 'This session is closed';
  END IF;
  SELECT id INTO _id FROM public.open_play_players
    WHERE session_id = _session AND lower(btrim(name)) = lower(_clean) FOR UPDATE;
  IF _id IS NULL THEN
    INSERT INTO public.open_play_players (session_id, name) VALUES (_session, _clean) RETURNING id INTO _id;
  ELSE
    UPDATE public.open_play_players SET queue_status = 'waiting', queued_at = now()
      WHERE id = _id AND queue_status = 'away';
  END IF;
  RETURN _id;
END $$;

CREATE FUNCTION public.open_play_join_queue(_session uuid, _name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _clean text := btrim(coalesce(_name, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to join the queue' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.open_play_sessions WHERE id = _session AND status = 'open') THEN
    RAISE EXCEPTION 'This session is closed';
  END IF;
  SELECT id INTO _id FROM public.open_play_players WHERE session_id = _session AND user_id = auth.uid() FOR UPDATE;
  IF _id IS NOT NULL THEN
    UPDATE public.open_play_players SET queue_status = 'waiting', queued_at = now()
      WHERE id = _id AND queue_status = 'away';
    RETURN _id;
  END IF;
  IF char_length(_clean) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Enter your name (up to 60 characters)'; END IF;
  IF EXISTS (SELECT 1 FROM public.open_play_players WHERE session_id = _session AND lower(btrim(name)) = lower(_clean)) THEN
    RAISE EXCEPTION 'That name is already on the list';
  END IF;
  INSERT INTO public.open_play_players (session_id, name, user_id) VALUES (_session, _clean, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE FUNCTION public.open_play_leave_queue(_player uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  SELECT user_id INTO _owner FROM public.open_play_players WHERE id = _player AND queue_status = 'waiting' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player is not waiting in the queue'; END IF;
  IF _owner IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'You can only leave the queue yourself' USING ERRCODE = '42501';
  END IF;
  UPDATE public.open_play_players SET queue_status = 'away' WHERE id = _player;
END $$;

CREATE FUNCTION public.open_play_remove_player(_player uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can remove players' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.open_play_matches WHERE _player = ANY (team_a) OR _player = ANY (team_b)) THEN
    RAISE EXCEPTION 'This player has games on record. Set them to away instead.';
  END IF;
  DELETE FROM public.open_play_players WHERE id = _player AND queue_status <> 'playing';
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found or currently on court'; END IF;
END $$;

-- Matches ----------------------------------------------------------------

CREATE FUNCTION public.open_play_make_match(_session uuid, _court text, _size integer DEFAULT 4)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ids uuid[]; _id uuid; _a uuid[]; _b uuid[]; _court_clean text := btrim(coalesce(_court, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can start matches' USING ERRCODE = '42501';
  END IF;
  IF _size NOT IN (2, 4) THEN RAISE EXCEPTION 'A match has 2 (singles) or 4 (doubles) players'; END IF;
  IF char_length(_court_clean) = 0 THEN RAISE EXCEPTION 'Choose a court'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.open_play_sessions WHERE id = _session AND status = 'open') THEN
    RAISE EXCEPTION 'This session is closed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.open_play_matches WHERE session_id = _session AND court = _court_clean AND state = 'playing') THEN
    RAISE EXCEPTION '% already has a match in progress', _court_clean;
  END IF;

  SELECT array_agg(q.id ORDER BY q.queued_at, q.created_at, q.id) INTO _ids FROM (
    SELECT id, queued_at, created_at FROM public.open_play_players
    WHERE session_id = _session AND queue_status = 'waiting'
    ORDER BY queued_at, created_at, id
    LIMIT _size FOR UPDATE
  ) q;
  IF _ids IS NULL OR cardinality(_ids) < _size THEN
    RAISE EXCEPTION 'Need % waiting players to start this match', _size;
  END IF;

  IF _size = 4 THEN
    _a := ARRAY[_ids[1], _ids[4]]; _b := ARRAY[_ids[2], _ids[3]];
  ELSE
    _a := ARRAY[_ids[1]]; _b := ARRAY[_ids[2]];
  END IF;

  INSERT INTO public.open_play_matches (session_id, court, team_a, team_b)
  VALUES (_session, _court_clean, _a, _b) RETURNING id INTO _id;
  UPDATE public.open_play_players SET queue_status = 'playing' WHERE id = ANY (_ids);
  RETURN _id;
END $$;

CREATE FUNCTION public.open_play_record_score(_match uuid, _score_a integer, _score_b integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.open_play_matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can record scores' USING ERRCODE = '42501';
  END IF;
  IF _score_a IS NULL OR _score_b IS NULL OR least(_score_a, _score_b) < 0 OR greatest(_score_a, _score_b) > 99
     OR abs(_score_a - _score_b) < 2 THEN
    RAISE EXCEPTION 'Enter a valid score: the winner must lead by at least 2';
  END IF;
  SELECT * INTO _m FROM public.open_play_matches WHERE id = _match AND state = 'playing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found or already scored'; END IF;
  UPDATE public.open_play_matches
    SET score_a = _score_a, score_b = _score_b, state = 'completed', completed_at = now()
    WHERE id = _match;
  -- Players go back to the end of the queue, winners just ahead of losers.
  UPDATE public.open_play_players SET queue_status = 'waiting',
    queued_at = clock_timestamp() + CASE
      WHEN (id = ANY (_m.team_a)) = (_score_a > _score_b) THEN interval '0 seconds' ELSE interval '1 millisecond'
    END
    WHERE id = ANY (_m.team_a || _m.team_b) AND queue_status = 'playing';
END $$;

CREATE FUNCTION public.open_play_edit_score(_match uuid, _score_a integer, _score_b integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can edit scores' USING ERRCODE = '42501';
  END IF;
  IF _score_a IS NULL OR _score_b IS NULL OR least(_score_a, _score_b) < 0 OR greatest(_score_a, _score_b) > 99
     OR abs(_score_a - _score_b) < 2 THEN
    RAISE EXCEPTION 'Enter a valid score: the winner must lead by at least 2';
  END IF;
  UPDATE public.open_play_matches SET score_a = _score_a, score_b = _score_b
    WHERE id = _match AND state = 'completed';
  IF NOT FOUND THEN RAISE EXCEPTION 'Completed match not found'; END IF;
END $$;

CREATE FUNCTION public.open_play_cancel_match(_match uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.open_play_matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can cancel matches' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _m FROM public.open_play_matches WHERE id = _match AND state = 'playing' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found or already scored'; END IF;
  -- Players keep their original place in the queue.
  UPDATE public.open_play_players SET queue_status = 'waiting'
    WHERE id = ANY (_m.team_a || _m.team_b) AND queue_status = 'playing';
  DELETE FROM public.open_play_matches WHERE id = _match;
END $$;

-- Only signed-in users can call the functions (admin checks happen inside).
DO $$
DECLARE _fn text;
BEGIN
  FOR _fn IN
    SELECT p.oid::regprocedure::text FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'open\_play\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', _fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', _fn);
  END LOOP;
END $$;

COMMIT;
