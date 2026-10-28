BEGIN;

CREATE TABLE public.pickleball_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  venue text NOT NULL CHECK (char_length(btrim(venue)) BETWEEN 1 AND 200),
  starts_at timestamptz NOT NULL,
  max_teams integer NOT NULL CHECK (max_teams BETWEEN 2 AND 32),
  points_to_win integer NOT NULL DEFAULT 11 CHECK (points_to_win IN (11, 15, 21)),
  status text NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'in_progress', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pickleball_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.pickleball_tournaments(id) ON DELETE CASCADE,
  captain_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  player_one text NOT NULL CHECK (char_length(btrim(player_one)) BETWEEN 2 AND 100),
  player_two text NOT NULL CHECK (char_length(btrim(player_two)) BETWEEN 2 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, captain_id),
  UNIQUE (tournament_id, id)
);
CREATE UNIQUE INDEX pickleball_team_names ON public.pickleball_teams(tournament_id, lower(btrim(name)));
CREATE TABLE public.pickleball_team_contacts (
  team_id uuid PRIMARY KEY REFERENCES public.pickleball_teams(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 5 AND 30)
);
CREATE TABLE public.pickleball_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.pickleball_tournaments(id) ON DELETE CASCADE,
  round_no integer NOT NULL CHECK (round_no BETWEEN 1 AND 5),
  position integer NOT NULL CHECK (position BETWEEN 1 AND 16),
  team_a_id uuid,
  team_b_id uuid,
  winner_id uuid,
  score_a integer CHECK (score_a BETWEEN 0 AND 999),
  score_b integer CHECK (score_b BETWEEN 0 AND 999),
  state text NOT NULL DEFAULT 'waiting' CHECK (state IN ('waiting', 'ready', 'completed', 'bye')),
  court text NOT NULL DEFAULT '' CHECK (char_length(court) <= 100),
  scheduled_at timestamptz,
  UNIQUE (tournament_id, round_no, position),
  FOREIGN KEY (tournament_id, team_a_id) REFERENCES public.pickleball_teams(tournament_id, id),
  FOREIGN KEY (tournament_id, team_b_id) REFERENCES public.pickleball_teams(tournament_id, id),
  FOREIGN KEY (tournament_id, winner_id) REFERENCES public.pickleball_teams(tournament_id, id),
  CHECK (team_a_id IS NULL OR team_b_id IS NULL OR team_a_id <> team_b_id),
  CHECK (winner_id IS NULL OR winner_id = team_a_id OR winner_id = team_b_id)
);

ALTER TABLE public.pickleball_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickleball_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickleball_team_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickleball_matches ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pickleball_tournaments, public.pickleball_teams, public.pickleball_matches TO anon, authenticated;
GRANT SELECT ON public.pickleball_team_contacts TO authenticated;
GRANT ALL ON public.pickleball_tournaments, public.pickleball_teams, public.pickleball_team_contacts, public.pickleball_matches TO service_role;
CREATE POLICY tournaments_public ON public.pickleball_tournaments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tournament_teams_public ON public.pickleball_teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tournament_matches_public ON public.pickleball_matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tournament_contacts_private ON public.pickleball_team_contacts FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.pickleball_teams t WHERE t.id = team_id AND t.captain_id = auth.uid()
  )
);

CREATE FUNCTION public.save_pickleball_tournament(
  _title text, _description text, _venue text, _starts_at timestamptz,
  _max_teams integer, _points_to_win integer, _id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.pickleball_tournaments;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF _starts_at IS NULL OR _starts_at <= now() THEN RAISE EXCEPTION 'Choose a future start date'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.pickleball_tournaments(title, description, venue, starts_at, max_teams, points_to_win, created_by)
    VALUES (btrim(_title), coalesce(_description, ''), btrim(_venue), _starts_at, _max_teams, _points_to_win, auth.uid()) RETURNING id INTO _id;
  ELSE
    SELECT * INTO _event FROM public.pickleball_tournaments WHERE id = _id FOR UPDATE;
    IF NOT FOUND OR _event.status <> 'registration' THEN RAISE EXCEPTION 'Only events accepting registrations can be edited'; END IF;
    IF _max_teams < (SELECT count(*) FROM public.pickleball_teams WHERE tournament_id = _id) THEN RAISE EXCEPTION 'Capacity cannot be less than registered teams'; END IF;
    UPDATE public.pickleball_tournaments SET title = btrim(_title), description = coalesce(_description, ''), venue = btrim(_venue),
      starts_at = _starts_at, max_teams = _max_teams, points_to_win = _points_to_win WHERE id = _id;
  END IF;
  RETURN _id;
END; $$;

CREATE FUNCTION public.register_pickleball_team(
  _tournament uuid, _name text, _player_one text, _player_two text, _phone text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.pickleball_tournaments; _team uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to register a team'; END IF;
  SELECT * INTO _event FROM public.pickleball_tournaments WHERE id = _tournament FOR UPDATE;
  IF NOT FOUND OR _event.status <> 'registration' OR _event.starts_at <= now() THEN RAISE EXCEPTION 'Registration is closed'; END IF;
  IF (SELECT count(*) FROM public.pickleball_teams WHERE tournament_id = _tournament) >= _event.max_teams THEN RAISE EXCEPTION 'Tournament is full'; END IF;
  INSERT INTO public.pickleball_teams(tournament_id, captain_id, name, player_one, player_two)
  VALUES (_tournament, auth.uid(), btrim(_name), btrim(_player_one), btrim(_player_two)) RETURNING id INTO _team;
  INSERT INTO public.pickleball_team_contacts(team_id, phone) VALUES (_team, btrim(_phone));
  RETURN _team;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This account or team name is already registered';
END; $$;

CREATE FUNCTION public.withdraw_pickleball_team(_team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tournament uuid; _event public.pickleball_tournaments;
BEGIN
  SELECT tournament_id INTO _tournament FROM public.pickleball_teams WHERE id = _team;
  SELECT * INTO _event FROM public.pickleball_tournaments WHERE id = _tournament FOR UPDATE;
  IF NOT FOUND OR _event.status <> 'registration' THEN RAISE EXCEPTION 'The draw is locked; teams cannot be removed'; END IF;
  DELETE FROM public.pickleball_teams WHERE id = _team AND (captain_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'You cannot remove this team'; END IF;
END; $$;

-- Internal propagation is callable only by the owner of the security-definer RPCs.
CREATE FUNCTION public.advance_pickleball_winner(_match uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _m public.pickleball_matches; _next uuid;
BEGIN
  SELECT * INTO _m FROM public.pickleball_matches WHERE id = _match;
  UPDATE public.pickleball_matches SET
    team_a_id = CASE WHEN _m.position % 2 = 1 THEN _m.winner_id ELSE team_a_id END,
    team_b_id = CASE WHEN _m.position % 2 = 0 THEN _m.winner_id ELSE team_b_id END
  WHERE tournament_id = _m.tournament_id AND round_no = _m.round_no + 1 AND position = (_m.position + 1) / 2
  RETURNING id INTO _next;
  IF _next IS NULL THEN
    UPDATE public.pickleball_tournaments SET status = 'completed' WHERE id = _m.tournament_id;
  ELSE
    UPDATE public.pickleball_matches SET state = 'ready' WHERE id = _next AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.advance_pickleball_winner(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.start_pickleball_tournament(_tournament uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.pickleball_tournaments; _teams uuid[]; _size integer := 2; _round integer := 1; _count integer; _i integer; _m record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO _event FROM public.pickleball_tournaments WHERE id = _tournament FOR UPDATE;
  IF NOT FOUND OR _event.status <> 'registration' THEN RAISE EXCEPTION 'Tournament has already started or is closed'; END IF;
  SELECT array_agg(id ORDER BY random()) INTO _teams FROM public.pickleball_teams WHERE tournament_id = _tournament;
  _count := coalesce(array_length(_teams, 1), 0);
  IF _count < 2 THEN RAISE EXCEPTION 'At least two teams are required'; END IF;
  WHILE _size < _count LOOP _size := _size * 2; END LOOP;
  FOR _i IN 1..(_size / 2) LOOP
    INSERT INTO public.pickleball_matches(tournament_id, round_no, position, team_a_id, team_b_id, winner_id, state)
    VALUES (_tournament, 1, _i, _teams[_i], _teams[_size + 1 - _i],
      CASE WHEN _teams[_size + 1 - _i] IS NULL THEN _teams[_i] END,
      CASE WHEN _teams[_size + 1 - _i] IS NULL THEN 'bye' ELSE 'ready' END);
  END LOOP;
  _size := _size / 2;
  WHILE _size > 1 LOOP
    _round := _round + 1; _size := _size / 2;
    FOR _i IN 1.._size LOOP
      INSERT INTO public.pickleball_matches(tournament_id, round_no, position) VALUES (_tournament, _round, _i);
    END LOOP;
  END LOOP;
  UPDATE public.pickleball_tournaments SET status = 'in_progress' WHERE id = _tournament;
  FOR _m IN SELECT id FROM public.pickleball_matches WHERE tournament_id = _tournament AND state = 'bye' LOOP
    PERFORM public.advance_pickleball_winner(_m.id);
  END LOOP;
END; $$;

CREATE FUNCTION public.score_pickleball_match(_match uuid, _score_a integer, _score_b integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.pickleball_tournaments; _m public.pickleball_matches; _event_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT tournament_id INTO _event_id FROM public.pickleball_matches WHERE id = _match;
  SELECT * INTO _event FROM public.pickleball_tournaments WHERE id = _event_id FOR UPDATE;
  SELECT * INTO _m FROM public.pickleball_matches WHERE id = _match FOR UPDATE;
  IF _event.status IS DISTINCT FROM 'in_progress' OR _m.state IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'This match is not ready for scoring'; END IF;
  IF _score_a IS NULL OR _score_b IS NULL OR least(_score_a, _score_b) < 0 OR greatest(_score_a, _score_b) > 999
     OR greatest(_score_a, _score_b) < _event.points_to_win OR abs(_score_a - _score_b) < 2 THEN
    RAISE EXCEPTION 'Winner must reach the target score and win by at least two points';
  END IF;
  UPDATE public.pickleball_matches SET score_a = _score_a, score_b = _score_b,
    winner_id = CASE WHEN _score_a > _score_b THEN team_a_id ELSE team_b_id END, state = 'completed' WHERE id = _match;
  PERFORM public.advance_pickleball_winner(_match);
END; $$;

CREATE FUNCTION public.schedule_pickleball_match(_match uuid, _court text, _scheduled_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _event public.pickleball_tournaments; _event_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT tournament_id INTO _event_id FROM public.pickleball_matches WHERE id = _match;
  SELECT * INTO _event FROM public.pickleball_tournaments WHERE id = _event_id FOR UPDATE;
  IF _event.status IS DISTINCT FROM 'in_progress' THEN RAISE EXCEPTION 'Only active tournaments can be scheduled'; END IF;
  UPDATE public.pickleball_matches SET court = coalesce(btrim(_court), ''), scheduled_at = _scheduled_at
  WHERE id = _match AND state IN ('waiting', 'ready');
  IF NOT FOUND THEN RAISE EXCEPTION 'Only unplayed matches can be scheduled'; END IF;
END; $$;

CREATE FUNCTION public.cancel_pickleball_tournament(_tournament uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  PERFORM 1 FROM public.pickleball_tournaments WHERE id = _tournament FOR UPDATE;
  UPDATE public.pickleball_tournaments SET status = 'cancelled' WHERE id = _tournament AND status IN ('registration', 'in_progress');
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament cannot be cancelled'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.save_pickleball_tournament(text,text,text,timestamptz,integer,integer,uuid),
  public.register_pickleball_team(uuid,text,text,text,text), public.withdraw_pickleball_team(uuid),
  public.start_pickleball_tournament(uuid), public.score_pickleball_match(uuid,integer,integer),
  public.schedule_pickleball_match(uuid,text,timestamptz), public.cancel_pickleball_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_pickleball_tournament(text,text,text,timestamptz,integer,integer,uuid),
  public.register_pickleball_team(uuid,text,text,text,text), public.withdraw_pickleball_team(uuid),
  public.start_pickleball_tournament(uuid), public.score_pickleball_match(uuid,integer,integer),
  public.schedule_pickleball_match(uuid,text,timestamptz), public.cancel_pickleball_tournament(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.pickleball_tournaments, public.pickleball_teams, public.pickleball_matches;
NOTIFY pgrst, 'reload schema';
COMMIT;
