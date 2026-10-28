BEGIN;

-- Explicit admin deletion intentionally removes history as well as current data.
-- Cancellation and result correction keep their existing preservation behavior.
CREATE OR REPLACE FUNCTION public.admin_delete_pickleball_tournaments(
 _events jsonb, _all boolean, _confirmation text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]; expected integer; actual integer; event_title text;
BEGIN
 IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Admin access required';
 END IF;
 IF _all IS NULL OR _events IS NULL OR jsonb_typeof(_events)<>'array' THEN
  RAISE EXCEPTION 'Choose tournaments to delete';
 END IF;
 expected:=jsonb_array_length(_events);
 IF expected=0 OR (NOT _all AND expected<>1) THEN RAISE EXCEPTION 'Choose tournaments to delete'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_events) item WHERE
  jsonb_typeof(item) IS DISTINCT FROM 'object' OR
  jsonb_typeof(item->'id') IS DISTINCT FROM 'string' OR
  jsonb_typeof(item->'revision') IS DISTINCT FROM 'number' OR
  (item->>'revision')::numeric<>(item->>'revision')::integer OR
  (item->>'revision')::integer<0
 ) THEN RAISE EXCEPTION 'Invalid tournament snapshot'; END IF;
 SELECT array_agg(id),count(DISTINCT id) INTO ids,actual
 FROM jsonb_to_recordset(_events) AS snapshot(id uuid,revision integer);
 IF actual<>expected THEN RAISE EXCEPTION 'Duplicate tournaments in deletion request'; END IF;

 -- Coordinate with event creation and every mutation's parent-row lock. Plain
 -- public reads continue; new/changed events cannot slip into a bulk deletion.
 LOCK TABLE public.pickleball_tournaments IN EXCLUSIVE MODE;
 PERFORM id FROM pickleball_tournaments WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 SELECT count(*) INTO actual FROM pickleball_tournaments e
 JOIN jsonb_to_recordset(_events) AS snapshot(id uuid,revision integer)
 ON snapshot.id=e.id AND snapshot.revision=e.revision;
 IF actual<>expected OR (_all AND (SELECT count(*) FROM pickleball_tournaments)<>expected) THEN
  RAISE EXCEPTION 'Tournament list changed. Close this dialog, refresh and try again.';
 END IF;
 IF _all THEN
  IF _confirmation IS DISTINCT FROM 'DELETE ALL TOURNAMENTS' THEN RAISE EXCEPTION 'Type DELETE ALL TOURNAMENTS to confirm'; END IF;
 ELSE
  SELECT title INTO event_title FROM pickleball_tournaments WHERE id=ids[1];
  IF _confirmation IS DISTINCT FROM event_title THEN RAISE EXCEPTION 'Type the tournament name to confirm'; END IF;
 END IF;

 -- Delete in dependency order. Matches reference each other and teams; prizes
 -- and final results also reference teams. Contacts cascade from deleted teams.
 DELETE FROM pickleball_prizes WHERE tournament_id=ANY(ids);
 DELETE FROM pickleball_results WHERE tournament_id=ANY(ids);
 DELETE FROM pickleball_matches WHERE tournament_id=ANY(ids);
 DELETE FROM pickleball_team_contacts WHERE team_id IN(SELECT id FROM pickleball_teams WHERE tournament_id=ANY(ids));
 DELETE FROM pickleball_audit WHERE tournament_id=ANY(ids);
 DELETE FROM pickleball_teams WHERE tournament_id=ANY(ids);
 DELETE FROM pickleball_tournaments WHERE id=ANY(ids);
 GET DIAGNOSTICS actual=ROW_COUNT;
 RETURN actual;
END; $$;
REVOKE ALL ON FUNCTION public.admin_delete_pickleball_tournaments(jsonb,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_pickleball_tournaments(jsonb,boolean,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
