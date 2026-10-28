BEGIN;

-- Keep existing tournament callers compatible. Streaming is optional and public.
CREATE OR REPLACE FUNCTION public.pickleball_valid_video_url(platform text, url text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(char_length(url)<=2048 AND CASE platform
 WHEN 'youtube' THEN url ~ '^https://(?:(?:www\.)?youtube\.com/(?:watch\?v=|live/|embed/)|youtu\.be/)[A-Za-z0-9_-]{11}(?:[?&][A-Za-z0-9_.~%=&+-]*)?$'
 WHEN 'facebook' THEN url ~ '^https://(?:(?:www|m|web)\.)?facebook\.com/(?:[A-Za-z0-9_.-]+/videos/[0-9]+/?|watch/?\?v=[0-9]+|video\.php\?v=[0-9]+|share/v/[A-Za-z0-9]+/?)(?:[?&][A-Za-z0-9_.~%=&+-]*)?$'
 ELSE false END,false);
$$;
CREATE OR REPLACE FUNCTION public.pickleball_valid_stream(config jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(jsonb_typeof(config)='object'
 AND jsonb_typeof(config->'platform')='string'
 AND jsonb_typeof(config->'status')='string'
 AND jsonb_typeof(config->'url')='string'
 AND jsonb_typeof(config->'replay_url')='string'
 AND config->>'status' IN ('scheduled','live','ended')
 AND CASE WHEN config->>'platform'='none' THEN config->>'url'='' AND config->>'replay_url'=''
 ELSE pickleball_valid_video_url(config->>'platform',config->>'url')
 AND (config->>'replay_url'='' OR pickleball_valid_video_url(config->>'platform',config->>'replay_url')) END,false);
$$;
ALTER TABLE public.pickleball_tournaments ADD COLUMN IF NOT EXISTS livestream jsonb NOT NULL
 DEFAULT '{"platform":"none","status":"scheduled","url":"","replay_url":""}'::jsonb;
ALTER TABLE public.pickleball_tournaments DROP CONSTRAINT IF EXISTS pickleball_tournaments_livestream_check;
ALTER TABLE public.pickleball_tournaments ADD CONSTRAINT pickleball_tournaments_livestream_check CHECK(public.pickleball_valid_stream(livestream));

-- One transaction saves the event, prizes and broadcast, retaining the existing
-- admin authorization, row lock and stale-revision protection in save_pickleball_event.
CREATE OR REPLACE FUNCTION public.save_pickleball_event_with_stream(
 _id uuid,_title text,_description text,_venue text,_starts_at timestamptz,_max_teams integer,_points_to_win integer,
 _format text,_requires_approval boolean,_currency text,_pool numeric,_prizes jsonb,_revision integer,_stream jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF NOT pickleball_valid_stream(_stream) THEN RAISE EXCEPTION 'Invalid livestream settings: use an HTTPS video link for the selected platform'; END IF;
 _id:=save_pickleball_event(_id,_title,_description,_venue,_starts_at,_max_teams,_points_to_win,_format,_requires_approval,_currency,_pool,_prizes,_revision);
 UPDATE pickleball_tournaments SET livestream=_stream WHERE id=_id;
 RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.save_pickleball_event_with_stream(uuid,text,text,text,timestamptz,integer,integer,text,boolean,text,numeric,jsonb,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_pickleball_event_with_stream(uuid,text,text,text,timestamptz,integer,integer,text,boolean,text,numeric,jsonb,integer,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
