BEGIN;
CREATE TABLE IF NOT EXISTS public.pickleball_currencies (
 code text PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
 decimals integer NOT NULL CHECK (decimals BETWEEN 0 AND 3)
);
INSERT INTO public.pickleball_currencies(code,decimals) VALUES
('AED',2),
('AFN',0),
('ALL',0),
('AMD',2),
('ANG',2),
('AOA',2),
('ARS',2),
('AUD',2),
('AWG',2),
('AZN',2),
('BAM',2),
('BBD',2),
('BDT',2),
('BGN',2),
('BHD',3),
('BIF',0),
('BMD',2),
('BND',2),
('BOB',2),
('BRL',2),
('BSD',2),
('BTN',2),
('BWP',2),
('BYN',2),
('BZD',2),
('CAD',2),
('CDF',2),
('CHF',2),
('CLP',0),
('CNY',2),
('COP',0),
('CRC',2),
('CUC',2),
('CUP',2),
('CVE',2),
('CZK',2),
('DJF',0),
('DKK',2),
('DOP',2),
('DZD',2),
('EGP',2),
('ERN',2),
('ETB',2),
('EUR',2),
('FJD',2),
('FKP',2),
('GBP',2),
('GEL',2),
('GHS',2),
('GIP',2),
('GMD',2),
('GNF',0),
('GTQ',2),
('GYD',2),
('HKD',2),
('HNL',2),
('HRK',2),
('HTG',2),
('HUF',0),
('IDR',0),
('ILS',2),
('INR',2),
('IQD',0),
('IRR',0),
('ISK',0),
('JMD',2),
('JOD',3),
('JPY',0),
('KES',2),
('KGS',2),
('KHR',2),
('KMF',0),
('KPW',0),
('KRW',0),
('KWD',3),
('KYD',2),
('KZT',2),
('LAK',0),
('LBP',0),
('LKR',2),
('LRD',2),
('LSL',2),
('LYD',3),
('MAD',2),
('MDL',2),
('MGA',0),
('MKD',2),
('MMK',0),
('MNT',2),
('MOP',2),
('MRU',2),
('MUR',2),
('MVR',2),
('MWK',2),
('MXN',2),
('MYR',2),
('MZN',2),
('NAD',2),
('NGN',2),
('NIO',2),
('NOK',2),
('NPR',2),
('NZD',2),
('OMR',3),
('PAB',2),
('PEN',2),
('PGK',2),
('PHP',2),
('PKR',0),
('PLN',2),
('PYG',0),
('QAR',2),
('RON',2),
('RSD',2),
('RUB',2),
('RWF',0),
('SAR',2),
('SBD',2),
('SCR',2),
('SDG',2),
('SEK',2),
('SGD',2),
('SHP',2),
('SLE',2),
('SLL',0),
('SOS',0),
('SRD',2),
('SSP',2),
('STN',2),
('SVC',2),
('SYP',0),
('SZL',2),
('THB',2),
('TJS',2),
('TMT',2),
('TND',3),
('TOP',2),
('TRY',2),
('TTD',2),
('TWD',2),
('TZS',2),
('UAH',2),
('UGX',0),
('USD',2),
('UYU',2),
('UZS',2),
('VES',2),
('VND',0),
('VUV',0),
('WST',2),
('XAF',0),
('XCD',2),
('XCG',2),
('XDR',2),
('XOF',0),
('XPF',0),
('XSU',2),
('YER',0),
('ZAR',2),
('ZMW',2),
('ZWG',2),
('ZWL',2) ON CONFLICT (code) DO NOTHING;
GRANT SELECT ON public.pickleball_currencies TO anon,authenticated;
GRANT ALL ON public.pickleball_currencies TO service_role;
ALTER TABLE public.pickleball_currencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pickleball_currencies_read ON public.pickleball_currencies;
CREATE POLICY pickleball_currencies_read ON public.pickleball_currencies FOR SELECT USING (true);

ALTER TABLE public.pickleball_tournaments
 ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'single' CHECK (format IN ('single','double')),
 ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PHP' REFERENCES public.pickleball_currencies(code),
 ADD COLUMN IF NOT EXISTS prize_pool numeric CHECK (prize_pool >= 0 AND prize_pool <= 999999999),
 ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS graph_initialized boolean NOT NULL DEFAULT false;
ALTER TABLE public.pickleball_teams ALTER COLUMN captain_id DROP NOT NULL;
ALTER TABLE public.pickleball_teams ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'approved'
 CHECK (registration_status IN ('pending','approved','rejected','withdrawn'));
ALTER TABLE public.pickleball_matches
 ADD COLUMN IF NOT EXISTS bracket text NOT NULL DEFAULT 'winners' CHECK (bracket IN ('winners','losers','championship')),
 ADD COLUMN IF NOT EXISTS source_a_match uuid REFERENCES public.pickleball_matches(id),
 ADD COLUMN IF NOT EXISTS source_b_match uuid REFERENCES public.pickleball_matches(id),
 ADD COLUMN IF NOT EXISTS source_a_outcome text NOT NULL DEFAULT 'winner' CHECK (source_a_outcome IN ('winner','loser')),
 ADD COLUMN IF NOT EXISTS source_b_outcome text NOT NULL DEFAULT 'winner' CHECK (source_b_outcome IN ('winner','loser')),
 ADD COLUMN IF NOT EXISTS seed_a_id uuid REFERENCES public.pickleball_teams(id),
 ADD COLUMN IF NOT EXISTS seed_b_id uuid REFERENCES public.pickleball_teams(id),
 ADD COLUMN IF NOT EXISTS activation_match uuid REFERENCES public.pickleball_matches(id);
ALTER TABLE public.pickleball_matches DROP CONSTRAINT IF EXISTS pickleball_matches_tournament_id_round_no_position_key;
ALTER TABLE public.pickleball_matches DROP CONSTRAINT IF EXISTS pickleball_matches_bracket_position_key;
ALTER TABLE public.pickleball_matches ADD CONSTRAINT pickleball_matches_bracket_position_key UNIQUE(tournament_id,bracket,round_no,position);
ALTER TABLE public.pickleball_matches DROP CONSTRAINT IF EXISTS pickleball_matches_round_no_check;
ALTER TABLE public.pickleball_matches ADD CONSTRAINT pickleball_matches_round_no_check CHECK (round_no BETWEEN 1 AND 10);
ALTER TABLE public.pickleball_matches DROP CONSTRAINT IF EXISTS pickleball_matches_state_check;
ALTER TABLE public.pickleball_matches ADD CONSTRAINT pickleball_matches_state_check CHECK (state IN ('waiting','ready','completed','bye','empty','not_needed'));

-- Backfill graph connections without changing any existing match result.
UPDATE public.pickleball_matches m SET seed_a_id=m.team_a_id,seed_b_id=m.team_b_id
WHERE NOT (SELECT graph_initialized FROM public.pickleball_tournaments WHERE id=m.tournament_id) AND bracket='winners' AND round_no=1 AND source_a_match IS NULL AND source_b_match IS NULL AND seed_a_id IS NULL AND seed_b_id IS NULL;
UPDATE public.pickleball_matches m SET
 source_a_match=(SELECT p.id FROM public.pickleball_matches p WHERE p.tournament_id=m.tournament_id AND p.bracket='winners' AND p.round_no=m.round_no-1 AND p.position=m.position*2-1),
 source_b_match=(SELECT p.id FROM public.pickleball_matches p WHERE p.tournament_id=m.tournament_id AND p.bracket='winners' AND p.round_no=m.round_no-1 AND p.position=m.position*2)
WHERE NOT (SELECT graph_initialized FROM public.pickleball_tournaments WHERE id=m.tournament_id) AND m.bracket='winners' AND m.round_no>1 AND m.source_a_match IS NULL AND m.source_b_match IS NULL;

UPDATE public.pickleball_tournaments SET graph_initialized=true;

CREATE TABLE IF NOT EXISTS public.pickleball_prizes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL REFERENCES public.pickleball_tournaments(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
 amount numeric CHECK (amount >= 0 AND amount <= 999999999),
 description text NOT NULL DEFAULT '' CHECK (char_length(description)<=2000),
 non_cash_reward text NOT NULL DEFAULT '' CHECK (char_length(non_cash_reward)<=1000),
 placement integer CHECK (placement BETWEEN 1 AND 32),
 recipient_team_id uuid,
 recipient_player text CHECK (char_length(recipient_player)<=100),
 sort_order integer NOT NULL DEFAULT 0,
 FOREIGN KEY (tournament_id,recipient_team_id) REFERENCES public.pickleball_teams(tournament_id,id),
 CHECK (placement IS NULL OR (recipient_team_id IS NULL AND recipient_player IS NULL))
);
CREATE TABLE IF NOT EXISTS public.pickleball_results (
 tournament_id uuid NOT NULL REFERENCES public.pickleball_tournaments(id) ON DELETE CASCADE,
 team_id uuid NOT NULL,
 placement integer CHECK (placement BETWEEN 1 AND 32),
 status text NOT NULL CHECK (status IN ('placed','withdrawn')),
 PRIMARY KEY(tournament_id,team_id),
 FOREIGN KEY(tournament_id,team_id) REFERENCES public.pickleball_teams(tournament_id,id)
);
CREATE TABLE IF NOT EXISTS public.pickleball_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL REFERENCES public.pickleball_tournaments(id),
 actor_id uuid,
 action text NOT NULL,
 reason text NOT NULL,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.pickleball_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickleball_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickleball_audit ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pickleball_prizes,public.pickleball_results TO anon,authenticated;
GRANT SELECT ON public.pickleball_audit TO authenticated;
GRANT ALL ON public.pickleball_prizes,public.pickleball_results,public.pickleball_audit TO service_role;
DROP POLICY IF EXISTS pickleball_prizes_read ON public.pickleball_prizes;
CREATE POLICY pickleball_prizes_read ON public.pickleball_prizes FOR SELECT USING (true);
DROP POLICY IF EXISTS pickleball_results_read ON public.pickleball_results;
CREATE POLICY pickleball_results_read ON public.pickleball_results FOR SELECT USING (true);
DROP POLICY IF EXISTS pickleball_audit_admin ON public.pickleball_audit;
CREATE POLICY pickleball_audit_admin ON public.pickleball_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.pickleball_admin_lock(_event uuid,_revision integer)
RETURNS public.pickleball_tournaments LANGUAGE plpgsql SET search_path=public AS $$
DECLARE e public.pickleball_tournaments;
BEGIN
 IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 SELECT * INTO e FROM pickleball_tournaments WHERE id=_event FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'; END IF;
 IF _revision IS NOT NULL AND e.revision<>_revision THEN RAISE EXCEPTION 'Tournament changed. Refresh and try again.'; END IF;
 RETURN e;
END; $$;

CREATE OR REPLACE FUNCTION public.pickleball_match_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD IS DISTINCT FROM NEW AND (
 OLD.state='completed' OR NEW.state='completed' OR
 OLD.source_a_match IS DISTINCT FROM NEW.source_a_match OR OLD.source_b_match IS DISTINCT FROM NEW.source_b_match OR
 OLD.source_a_outcome IS DISTINCT FROM NEW.source_a_outcome OR OLD.source_b_outcome IS DISTINCT FROM NEW.source_b_outcome OR
 OLD.seed_a_id IS DISTINCT FROM NEW.seed_a_id OR OLD.seed_b_id IS DISTINCT FROM NEW.seed_b_id
 ) THEN
 INSERT INTO pickleball_audit(tournament_id,actor_id,action,reason,before_data,after_data)
 VALUES(NEW.tournament_id,auth.uid(),'match_updated',coalesce(nullif(current_setting('app.pickleball_reason',true),''),'Match progression'),to_jsonb(OLD),to_jsonb(NEW));
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS pickleball_match_history ON public.pickleball_matches;
CREATE TRIGGER pickleball_match_history AFTER UPDATE ON public.pickleball_matches FOR EACH ROW EXECUTE FUNCTION public.pickleball_match_history();

CREATE OR REPLACE FUNCTION public.pickleball_reset_downstream(_event uuid,_roots uuid[],_confirm boolean)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE ids uuid[];
BEGIN
 WITH RECURSIVE affected(id) AS (
 SELECT unnest(_roots)
 UNION
 SELECT m.id FROM pickleball_matches m JOIN affected a ON a.id IN(m.source_a_match,m.source_b_match,m.activation_match)
 WHERE m.tournament_id=_event
 ) SELECT array_agg(id) INTO ids FROM affected;
 IF _confirm IS NOT TRUE AND EXISTS(SELECT 1 FROM pickleball_matches WHERE id=ANY(ids) AND state='completed') THEN
 RAISE EXCEPTION 'Confirm resetting affected results before making this correction';
 END IF;
 UPDATE pickleball_matches SET score_a=NULL,score_b=NULL,winner_id=NULL,state='waiting' WHERE id=ANY(ids);
END; $$;

CREATE OR REPLACE FUNCTION public.pickleball_reconcile(_event uuid)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE e public.pickleball_tournaments; m record; src public.pickleball_matches; a uuid; b uuid; winner uuid;
 ar boolean; br boolean; newstate text; done uuid[]:=ARRAY[]::uuid[]; found_any boolean; total integer;
 final_match public.pickleball_matches; first_final public.pickleball_matches; final_winner uuid; runner uuid;
BEGIN
 SELECT * INTO e FROM pickleball_tournaments WHERE id=_event;
 SELECT count(*) INTO total FROM pickleball_matches WHERE tournament_id=_event;
 IF total=0 THEN RETURN; END IF;
 LOOP
 found_any:=false;
 FOR m IN SELECT * FROM pickleball_matches WHERE tournament_id=_event AND NOT(id=ANY(done))
 AND (source_a_match IS NULL OR source_a_match=ANY(done))
 AND (source_b_match IS NULL OR source_b_match=ANY(done))
 AND (activation_match IS NULL OR activation_match=ANY(done)) ORDER BY bracket,round_no,position LOOP
 found_any:=true; a:=NULL;b:=NULL;ar:=true;br:=true;
 IF m.source_a_match IS NULL THEN
 SELECT id INTO a FROM pickleball_teams WHERE id=m.seed_a_id AND tournament_id=_event AND registration_status='approved';
 ELSE
 SELECT * INTO src FROM pickleball_matches WHERE id=m.source_a_match AND tournament_id=_event;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid match source'; END IF;
 ar:=src.state IN('completed','bye','empty','not_needed');
 a:=CASE WHEN m.source_a_outcome='winner' AND ar THEN src.winner_id WHEN m.source_a_outcome='loser' AND src.state='completed' THEN CASE WHEN src.winner_id=src.team_a_id THEN src.team_b_id ELSE src.team_a_id END END;
 END IF;
 IF m.source_b_match IS NULL THEN
 SELECT id INTO b FROM pickleball_teams WHERE id=m.seed_b_id AND tournament_id=_event AND registration_status='approved';
 ELSE
 SELECT * INTO src FROM pickleball_matches WHERE id=m.source_b_match AND tournament_id=_event;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid match source'; END IF;
 br:=src.state IN('completed','bye','empty','not_needed');
 b:=CASE WHEN m.source_b_outcome='winner' AND br THEN src.winner_id WHEN m.source_b_outcome='loser' AND src.state='completed' THEN CASE WHEN src.winner_id=src.team_a_id THEN src.team_b_id ELSE src.team_a_id END END;
 END IF;
 winner:=NULL;
 IF a IS NOT NULL AND a=b THEN RAISE EXCEPTION 'A team cannot play itself; correct the bracket sources'; END IF;
 IF NOT ar OR NOT br THEN newstate:='waiting';
 ELSIF a IS NULL AND b IS NULL THEN newstate:='empty';
 ELSIF a IS NULL OR b IS NULL THEN newstate:='bye';winner:=coalesce(a,b);
 ELSIF m.state='completed' AND m.team_a_id=a AND m.team_b_id=b THEN newstate:='completed';winner:=m.winner_id;
 ELSE newstate:='ready'; END IF;
 IF m.activation_match IS NOT NULL THEN
 SELECT * INTO src FROM pickleball_matches WHERE id=m.activation_match AND tournament_id=_event;
 IF src.state IN('completed','bye','empty') AND (src.state<>'completed' OR EXISTS(
 SELECT 1 FROM pickleball_matches prior WHERE prior.tournament_id=_event AND prior.id<>src.id AND prior.bracket<>'championship'
 AND prior.state='completed' AND
 (CASE WHEN src.winner_id=src.team_a_id THEN src.team_b_id ELSE src.team_a_id END) IN(prior.team_a_id,prior.team_b_id)
 AND prior.winner_id<>(CASE WHEN src.winner_id=src.team_a_id THEN src.team_b_id ELSE src.team_a_id END)
 )) THEN
 newstate:='not_needed';a:=NULL;b:=NULL;winner:=NULL;
 END IF;
 END IF;
 UPDATE pickleball_matches SET team_a_id=a,team_b_id=b,winner_id=winner,state=newstate,
 score_a=CASE WHEN newstate='completed' THEN score_a END,score_b=CASE WHEN newstate='completed' THEN score_b END WHERE id=m.id;
 done:=array_append(done,m.id);
 END LOOP;
 EXIT WHEN NOT found_any;
 END LOOP;
 IF cardinality(done)<>total THEN RAISE EXCEPTION 'Bracket placement would create a cycle'; END IF;
 IF e.status IN('registration','cancelled') THEN RETURN; END IF;
 IF e.format='double' THEN
 SELECT * INTO first_final FROM pickleball_matches WHERE tournament_id=_event AND bracket='championship' AND round_no=1;
 SELECT * INTO final_match FROM pickleball_matches WHERE tournament_id=_event AND bracket='championship' AND round_no=2;
 IF final_match.state='not_needed' THEN final_match:=first_final; END IF;
 ELSE
 SELECT * INTO final_match FROM pickleball_matches WHERE tournament_id=_event AND bracket='winners' ORDER BY round_no DESC LIMIT 1;
 END IF;
 DELETE FROM pickleball_results WHERE tournament_id=_event;
 IF final_match.state IN('completed','bye') AND final_match.winner_id IS NOT NULL THEN
 final_winner:=final_match.winner_id;
 runner:=CASE WHEN final_winner=final_match.team_a_id THEN final_match.team_b_id ELSE final_match.team_a_id END;
 INSERT INTO pickleball_results VALUES(_event,final_winner,1,'placed');
 IF runner IS NOT NULL THEN INSERT INTO pickleball_results VALUES(_event,runner,2,'placed'); END IF;
 INSERT INTO pickleball_results(tournament_id,team_id,placement,status)
 SELECT _event,loser,(rank() OVER(ORDER BY round_no DESC))::integer+CASE WHEN runner IS NULL THEN 1 ELSE 2 END,'placed'
 FROM (
 SELECT played.round_no,CASE WHEN played.winner_id=played.team_a_id THEN played.team_b_id ELSE played.team_a_id END loser
 FROM pickleball_matches played WHERE played.tournament_id=_event AND played.state='completed'
 AND played.bracket=CASE WHEN e.format='double' THEN 'losers' ELSE 'winners' END
 AND played.id<>final_match.id
 ) losses WHERE loser<>final_winner AND loser IS DISTINCT FROM runner
 AND EXISTS(SELECT 1 FROM pickleball_teams t WHERE t.id=loser AND t.registration_status='approved');
 INSERT INTO pickleball_results SELECT _event,id,NULL,'withdrawn' FROM pickleball_teams WHERE tournament_id=_event AND registration_status='withdrawn';
 IF (SELECT count(*) FROM pickleball_results WHERE tournament_id=_event)<>(SELECT count(*) FROM pickleball_teams WHERE tournament_id=_event AND registration_status IN('approved','withdrawn')) THEN
 RAISE EXCEPTION 'Bracket cannot produce a consistent final ranking; review manual placements';
 END IF;
 UPDATE pickleball_tournaments SET status='completed' WHERE id=_event;
 ELSE UPDATE pickleball_tournaments SET status='in_progress' WHERE id=_event; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.start_pickleball_tournament(_tournament uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.pickleball_tournaments; teams uuid[]; size integer:=2; rounds integer:=1; r integer;i integer; n integer; a uuid;b uuid; f uuid;
BEGIN
 e:=pickleball_admin_lock(_tournament,NULL);
 IF e.status<>'registration' THEN RAISE EXCEPTION 'Tournament has already started or is closed'; END IF;
 SELECT array_agg(id ORDER BY random()) INTO teams FROM pickleball_teams WHERE tournament_id=_tournament AND registration_status='approved';
 n:=coalesce(cardinality(teams),0);
 IF n<2 THEN RAISE EXCEPTION 'At least two approved teams are required'; END IF;
 WHILE size<n LOOP size:=size*2;rounds:=rounds+1;END LOOP;
 FOR r IN 1..rounds LOOP
 FOR i IN 1..(size/(2^r)::integer) LOOP
 a:=NULL;b:=NULL;
 IF r>1 THEN
 SELECT id INTO a FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='winners' AND round_no=r-1 AND position=i*2-1;
 SELECT id INTO b FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='winners' AND round_no=r-1 AND position=i*2;
 END IF;
 INSERT INTO pickleball_matches(tournament_id,bracket,round_no,position,source_a_match,source_b_match,seed_a_id,seed_b_id)
 VALUES(_tournament,'winners',r,i,a,b,CASE WHEN r=1 THEN teams[i] END,CASE WHEN r=1 THEN teams[size+1-i] END);
 END LOOP;END LOOP;
 IF e.format='double' THEN
 IF rounds>1 THEN
 FOR i IN 1..(size/4) LOOP
 SELECT id INTO a FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='winners' AND round_no=1 AND position=i*2-1;
 SELECT id INTO b FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='winners' AND round_no=1 AND position=i*2;
 INSERT INTO pickleball_matches(tournament_id,bracket,round_no,position,source_a_match,source_b_match,source_a_outcome,source_b_outcome)
 VALUES(_tournament,'losers',1,i,a,b,'loser','loser');
 END LOOP;
 FOR r IN 2..rounds LOOP
 FOR i IN 1..(size/(2^r)::integer) LOOP
 SELECT id INTO a FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='losers' AND round_no=2*r-3 AND position=i;
 SELECT id INTO b FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='winners' AND round_no=r AND position=(size/(2^r)::integer)+1-i;
 INSERT INTO pickleball_matches(tournament_id,bracket,round_no,position,source_a_match,source_b_match,source_b_outcome)
 VALUES(_tournament,'losers',2*r-2,i,a,b,'loser');
 END LOOP;
 IF r<rounds THEN
 FOR i IN 1..(size/(2^(r+1))::integer) LOOP
 SELECT id INTO a FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='losers' AND round_no=2*r-2 AND position=i*2-1;
 SELECT id INTO b FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='losers' AND round_no=2*r-2 AND position=i*2;
 INSERT INTO pickleball_matches(tournament_id,bracket,round_no,position,source_a_match,source_b_match)
 VALUES(_tournament,'losers',2*r-1,i,a,b);
 END LOOP;
 END IF;
 END LOOP;
 END IF;
 SELECT id INTO a FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='winners' AND round_no=rounds;
 IF rounds=1 THEN b:=a;
 ELSE SELECT id INTO b FROM pickleball_matches WHERE tournament_id=_tournament AND bracket='losers' AND round_no=2*rounds-2; END IF;
 INSERT INTO pickleball_matches(tournament_id,bracket,round_no,position,source_a_match,source_b_match,source_b_outcome)
 VALUES(_tournament,'championship',1,1,a,b,CASE WHEN rounds=1 THEN 'loser' ELSE 'winner' END) RETURNING id INTO f;
 INSERT INTO pickleball_matches(tournament_id,bracket,round_no,position,source_a_match,source_b_match,source_b_outcome,activation_match)
 VALUES(_tournament,'championship',2,1,f,f,'loser',f);
 END IF;
 UPDATE pickleball_tournaments SET status='in_progress',graph_initialized=true,revision=revision+1 WHERE id=_tournament;
 PERFORM pickleball_reconcile(_tournament);
 INSERT INTO pickleball_audit(tournament_id,actor_id,action,reason) VALUES(_tournament,auth.uid(),'draw_started','Approved teams randomly seeded');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_record_pickleball_result(
 _match uuid,_score_a integer,_score_b integer,_clear boolean,_reason text,_confirm boolean,_revision integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.pickleball_tournaments;m public.pickleball_matches;children uuid[];
BEGIN
 SELECT * INTO m FROM pickleball_matches WHERE id=_match;
 e:=pickleball_admin_lock(m.tournament_id,_revision);
 SELECT * INTO m FROM pickleball_matches WHERE id=_match;
 IF e.status NOT IN('in_progress','completed') OR m.state NOT IN('ready','completed') THEN RAISE EXCEPTION 'This match is not ready for scoring'; END IF;
 IF m.state='completed' AND char_length(btrim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'A correction reason is required'; END IF;
 IF NOT _clear AND (_score_a IS NULL OR _score_b IS NULL OR least(_score_a,_score_b)<0 OR greatest(_score_a,_score_b)>999 OR greatest(_score_a,_score_b)<e.points_to_win OR abs(_score_a-_score_b)<2) THEN
 RAISE EXCEPTION 'Winner must reach the target score and win by at least two points'; END IF;
 PERFORM set_config('app.pickleball_reason',coalesce(nullif(btrim(_reason),''),'Match result'),true);
 IF m.state='completed' THEN
 PERFORM pickleball_reset_downstream(e.id,ARRAY[m.id],_confirm);
 END IF;
 IF NOT _clear THEN
 UPDATE pickleball_matches SET score_a=_score_a,score_b=_score_b,winner_id=CASE WHEN _score_a>_score_b THEN team_a_id ELSE team_b_id END,state='completed' WHERE id=_match;
 END IF;
 PERFORM pickleball_reconcile(e.id);
 UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=e.id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_pickleball_tournament(
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
    IF _max_teams < (SELECT count(*) FROM public.pickleball_teams WHERE tournament_id = _id AND registration_status IN('pending','approved')) THEN RAISE EXCEPTION 'Capacity cannot be less than registered teams'; END IF;
    UPDATE public.pickleball_tournaments SET title = btrim(_title), description = coalesce(_description, ''), venue = btrim(_venue),
      starts_at = _starts_at, max_teams = _max_teams, points_to_win = _points_to_win WHERE id = _id;
  END IF;
  UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=_id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_pickleball_team(_team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tournament uuid; _event public.pickleball_tournaments;
BEGIN
  SELECT tournament_id INTO _tournament FROM public.pickleball_teams WHERE id = _team;
  SELECT * INTO _event FROM public.pickleball_tournaments WHERE id = _tournament FOR UPDATE;
  IF NOT FOUND OR _event.status <> 'registration' THEN RAISE EXCEPTION 'The draw is locked; teams cannot be removed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pickleball_teams WHERE id=_team AND (captain_id=auth.uid() OR has_role(auth.uid(),'admin'))) THEN RAISE EXCEPTION 'You cannot remove this team'; END IF;
  UPDATE pickleball_prizes SET recipient_team_id=NULL,recipient_player=NULL WHERE recipient_team_id=_team;
  INSERT INTO pickleball_audit(tournament_id,actor_id,action,reason,before_data)
  SELECT _tournament,auth.uid(),'team_removed','Registration removed',to_jsonb(t) FROM pickleball_teams t WHERE id=_team;
  DELETE FROM public.pickleball_teams WHERE id = _team AND (captain_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'You cannot remove this team'; END IF;
  UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=_tournament;
END; $$;

CREATE OR REPLACE FUNCTION public.schedule_pickleball_match(_match uuid, _court text, _scheduled_at timestamptz)
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
  UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=_event_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_pickleball_tournament(_tournament uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  PERFORM 1 FROM public.pickleball_tournaments WHERE id = _tournament FOR UPDATE;
  UPDATE public.pickleball_tournaments SET status = 'cancelled',revision=revision+1 WHERE id = _tournament AND status IN ('registration', 'in_progress');
  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament cannot be cancelled'; END IF;
END; $$;

-- Keep the original score endpoint and its no-replay contract for older callers.
CREATE OR REPLACE FUNCTION public.score_pickleball_match(_match uuid,_score_a integer,_score_b integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.pickleball_tournaments;m public.pickleball_matches;
BEGIN
 SELECT * INTO m FROM pickleball_matches WHERE id=_match;
 e:=pickleball_admin_lock(m.tournament_id,NULL);
 SELECT * INTO m FROM pickleball_matches WHERE id=_match;
 IF e.status<>'in_progress' OR m.state<>'ready' THEN RAISE EXCEPTION 'This match is not ready for scoring'; END IF;
 PERFORM admin_record_pickleball_result(_match,_score_a,_score_b,false,'Match result',false,e.revision);
END; $$;

CREATE OR REPLACE FUNCTION public.move_pickleball_slot(
 _from_match uuid,_from_slot text,_to_match uuid,_to_slot text,_reason text,_confirm boolean,_revision integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.pickleball_tournaments;f public.pickleball_matches;t public.pickleball_matches;
 fs uuid;ts uuid;fo text;to_out text;ft uuid;tt uuid;
BEGIN
 SELECT * INTO f FROM pickleball_matches WHERE id=_from_match;
 e:=pickleball_admin_lock(f.tournament_id,_revision);
 SELECT * INTO f FROM pickleball_matches WHERE id=_from_match;
 SELECT * INTO t FROM pickleball_matches WHERE id=_to_match AND tournament_id=e.id;
 IF NOT FOUND OR f.activation_match IS NOT NULL OR t.activation_match IS NOT NULL OR _from_slot IS NULL OR _to_slot IS NULL OR e.status NOT IN('in_progress','completed') OR _from_slot NOT IN('a','b') OR _to_slot NOT IN('a','b') OR (_from_match=_to_match AND _from_slot=_to_slot) THEN RAISE EXCEPTION 'Choose two different slots in this tournament'; END IF;
 IF char_length(btrim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'A placement correction reason is required'; END IF;
 -- Swap entire source bindings, so a winner/loser output is never duplicated.
 fs:=CASE WHEN _from_slot='a' THEN f.source_a_match ELSE f.source_b_match END;
 ts:=CASE WHEN _to_slot='a' THEN t.source_a_match ELSE t.source_b_match END;
 fo:=CASE WHEN _from_slot='a' THEN f.source_a_outcome ELSE f.source_b_outcome END;
 to_out:=CASE WHEN _to_slot='a' THEN t.source_a_outcome ELSE t.source_b_outcome END;
 ft:=CASE WHEN _from_slot='a' THEN f.seed_a_id ELSE f.seed_b_id END;
 tt:=CASE WHEN _to_slot='a' THEN t.seed_a_id ELSE t.seed_b_id END;
 PERFORM set_config('app.pickleball_reason',btrim(_reason),true);
 PERFORM pickleball_reset_downstream(e.id,ARRAY[f.id,t.id],_confirm);
 IF _from_slot='a' THEN UPDATE pickleball_matches SET source_a_match=ts,source_a_outcome=to_out,seed_a_id=tt WHERE id=f.id;
 ELSE UPDATE pickleball_matches SET source_b_match=ts,source_b_outcome=to_out,seed_b_id=tt WHERE id=f.id; END IF;
 IF _to_slot='a' THEN UPDATE pickleball_matches SET source_a_match=fs,source_a_outcome=fo,seed_a_id=ft WHERE id=t.id;
 ELSE UPDATE pickleball_matches SET source_b_match=fs,source_b_outcome=fo,seed_b_id=ft WHERE id=t.id; END IF;
 PERFORM pickleball_reconcile(e.id);
 UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=e.id;
END; $$;

CREATE OR REPLACE FUNCTION public.register_pickleball_team(_tournament uuid,_name text,_player_one text,_player_two text,_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.pickleball_tournaments;team uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to register a team';END IF;
 SELECT * INTO e FROM pickleball_tournaments WHERE id=_tournament FOR UPDATE;
 IF NOT FOUND OR e.status<>'registration' OR e.starts_at<=now() THEN RAISE EXCEPTION 'Registration is closed'; END IF;
 IF (SELECT count(*) FROM pickleball_teams WHERE tournament_id=_tournament AND registration_status IN('pending','approved'))>=e.max_teams THEN RAISE EXCEPTION 'Tournament is full'; END IF;
 INSERT INTO pickleball_teams(tournament_id,captain_id,name,player_one,player_two,registration_status)
 VALUES(_tournament,auth.uid(),btrim(_name),btrim(_player_one),btrim(_player_two),CASE WHEN e.requires_approval THEN 'pending' ELSE 'approved' END) RETURNING id INTO team;
 INSERT INTO pickleball_team_contacts VALUES(team,btrim(_phone));
 UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=_tournament;
 RETURN team;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'This account or team name is already registered';
END; $$;

CREATE OR REPLACE FUNCTION public.manage_pickleball_team(
 _tournament uuid,_team uuid,_name text,_player_one text,_player_two text,_phone text,_status text,_reason text,_confirm boolean,_revision integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.pickleball_tournaments;old_team public.pickleball_teams;roots uuid[];
BEGIN
 e:=pickleball_admin_lock(_tournament,_revision);
 IF e.status='cancelled' THEN RAISE EXCEPTION 'Cancelled tournament cannot change participants'; END IF;
 IF _team IS NOT NULL THEN SELECT * INTO old_team FROM pickleball_teams WHERE id=_team AND tournament_id=_tournament;
 IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF; END IF;
 IF e.status<>'registration' AND (_team IS NULL OR _status NOT IN('approved','withdrawn') OR (old_team.registration_status<>'approved' AND _status<>old_team.registration_status)) THEN
 RAISE EXCEPTION 'After the draw, update team details or withdraw an existing team'; END IF;
 IF e.status='registration' AND _status NOT IN('pending','approved','rejected','withdrawn') THEN RAISE EXCEPTION 'Invalid registration status'; END IF;
 IF _status IN('approved','pending') AND (SELECT count(*) FROM pickleball_teams WHERE tournament_id=_tournament AND id IS DISTINCT FROM _team AND registration_status IN('approved','pending'))>=e.max_teams THEN RAISE EXCEPTION 'Tournament is full'; END IF;
 IF _team IS NULL THEN
 INSERT INTO pickleball_teams(tournament_id,name,player_one,player_two,registration_status)
 VALUES(_tournament,btrim(_name),btrim(_player_one),btrim(_player_two),_status) RETURNING id INTO _team;
 ELSE
 IF e.status<>'registration' AND old_team.registration_status IS DISTINCT FROM _status THEN
 IF char_length(btrim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'A withdrawal reason is required'; END IF;
 SELECT array_agg(id) INTO roots FROM pickleball_matches WHERE tournament_id=_tournament AND _team IN(seed_a_id,seed_b_id);
 PERFORM set_config('app.pickleball_reason',_reason,true);
 PERFORM pickleball_reset_downstream(_tournament,coalesce(roots,ARRAY[]::uuid[]),_confirm);
 END IF;
 UPDATE pickleball_prizes SET recipient_player=CASE WHEN recipient_player=old_team.player_one THEN btrim(_player_one) ELSE btrim(_player_two) END
 WHERE recipient_team_id=_team AND recipient_player IN(old_team.player_one,old_team.player_two);
 UPDATE pickleball_teams SET name=btrim(_name),player_one=btrim(_player_one),player_two=btrim(_player_two),registration_status=_status WHERE id=_team;
 END IF;
 INSERT INTO pickleball_team_contacts VALUES(_team,btrim(_phone)) ON CONFLICT(team_id) DO UPDATE SET phone=EXCLUDED.phone;
 INSERT INTO pickleball_audit(tournament_id,actor_id,action,reason,before_data,after_data)
 VALUES(_tournament,auth.uid(),'team_updated',coalesce(nullif(btrim(_reason),''),'Registration management'),to_jsonb(old_team),(SELECT to_jsonb(t) FROM pickleball_teams t WHERE id=_team));
 IF e.status<>'registration' THEN PERFORM pickleball_reconcile(_tournament); END IF;
 UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=_tournament;
 RETURN _team;
END; $$;

CREATE OR REPLACE FUNCTION public.pickleball_write_prizes(_event uuid,_currency text,_pool numeric,_prizes jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE digits integer;p jsonb;amount numeric;recipient uuid;player text;place integer;prize_id uuid;ord integer:=0;old_prizes jsonb;
BEGIN
 SELECT decimals INTO digits FROM pickleball_currencies WHERE code=_currency;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a supported currency'; END IF;
 IF _pool IS NOT NULL AND (_pool<0 OR _pool>999999999 OR round(_pool,digits)<>_pool) THEN RAISE EXCEPTION 'Invalid prize pool or currency decimal places'; END IF;
 IF _prizes IS NULL OR jsonb_typeof(_prizes)<>'array' THEN RAISE EXCEPTION 'Prizes must be a list'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(existing)),'[]'::jsonb) INTO old_prizes FROM pickleball_prizes existing WHERE tournament_id=_event;
 -- Do not allow an event's incoming identifiers to replace another event's awards.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_prizes) x JOIN pickleball_prizes existing ON existing.id=nullif(x->>'id','')::uuid WHERE existing.tournament_id<>_event) THEN RAISE EXCEPTION 'Prize belongs to another tournament';END IF;
 DELETE FROM pickleball_prizes WHERE tournament_id=_event;
 FOR p IN SELECT value FROM jsonb_array_elements(_prizes) LOOP
 IF jsonb_typeof(p)<>'object' THEN RAISE EXCEPTION 'Invalid prize entry';END IF;
 amount:=nullif(p->>'amount','')::numeric;
 IF amount IS NOT NULL AND (amount<0 OR amount>999999999 OR round(amount,digits)<>amount) THEN RAISE EXCEPTION 'Invalid prize amount or currency decimal places'; END IF;
 prize_id:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());
 recipient:=nullif(p->>'recipient_team_id','')::uuid;
 player:=nullif(btrim(p->>'recipient_player'),'');
 place:=nullif(p->>'placement','')::integer;
 IF recipient IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pickleball_teams WHERE id=recipient AND tournament_id=_event AND registration_status IN('approved','withdrawn')) THEN RAISE EXCEPTION 'Select a participating team for this award'; END IF;
 IF player IS NOT NULL AND (recipient IS NULL OR NOT EXISTS(SELECT 1 FROM pickleball_teams WHERE id=recipient AND player IN(player_one,player_two))) THEN RAISE EXCEPTION 'Select one of the recipient team players'; END IF;
 INSERT INTO pickleball_prizes(id,tournament_id,title,amount,description,non_cash_reward,placement,recipient_team_id,recipient_player,sort_order)
 VALUES(prize_id,_event,btrim(p->>'title'),amount,coalesce(p->>'description',''),coalesce(p->>'non_cash_reward',''),place,recipient,player,ord);
 ord:=ord+1;
 END LOOP;
 UPDATE pickleball_tournaments SET currency=_currency,prize_pool=_pool WHERE id=_event;
 INSERT INTO pickleball_audit(tournament_id,actor_id,action,reason,before_data,after_data)
 VALUES(_event,auth.uid(),'prizes_updated','Prize list updated',old_prizes,jsonb_build_object('currency',_currency,'pool',_pool,'prizes',_prizes));
END; $$;

CREATE OR REPLACE FUNCTION public.save_pickleball_prizes(_event uuid,_currency text,_pool numeric,_prizes jsonb,_revision integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pickleball_admin_lock(_event,_revision);
 PERFORM pickleball_write_prizes(_event,_currency,_pool,_prizes);
 UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=_event;
END; $$;

CREATE OR REPLACE FUNCTION public.save_pickleball_event(
 _id uuid,_title text,_description text,_venue text,_starts_at timestamptz,_max_teams integer,_points_to_win integer,
 _format text,_requires_approval boolean,_currency text,_pool numeric,_prizes jsonb,_revision integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.pickleball_tournaments;
BEGIN
 IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required';END IF;
 IF _id IS NULL THEN
 _id:=save_pickleball_tournament(_title,_description,_venue,_starts_at,_max_teams,_points_to_win,NULL);
 ELSE
 e:=pickleball_admin_lock(_id,_revision);
 IF e.status='registration' THEN
 PERFORM save_pickleball_tournament(_title,_description,_venue,_starts_at,_max_teams,_points_to_win,_id);
 ELSE
 IF _max_teams<>e.max_teams OR _points_to_win<>e.points_to_win OR _format<>e.format OR _requires_approval<>e.requires_approval THEN RAISE EXCEPTION 'Format, capacity, approval and scoring rules are locked after the draw';END IF;
 UPDATE pickleball_tournaments SET title=btrim(_title),description=coalesce(_description,''),venue=btrim(_venue),starts_at=_starts_at WHERE id=_id;
 END IF;
 END IF;
 UPDATE pickleball_tournaments SET format=_format,requires_approval=_requires_approval WHERE id=_id;
 PERFORM pickleball_write_prizes(_id,_currency,_pool,_prizes);
 UPDATE pickleball_tournaments SET revision=revision+1 WHERE id=_id;
 RETURN _id;
END; $$;

CREATE OR REPLACE VIEW public.pickleball_awards AS
 SELECT p.id AS prize_id,p.tournament_id,r.team_id,p.recipient_player,r.placement,p.title,p.amount,p.description,p.non_cash_reward,e.currency
 FROM pickleball_prizes p JOIN pickleball_tournaments e ON e.id=p.tournament_id
 JOIN pickleball_results r ON r.tournament_id=p.tournament_id AND
 ((p.placement IS NOT NULL AND r.placement=p.placement) OR (p.placement IS NULL AND r.team_id=p.recipient_team_id))
 WHERE e.status='completed';
GRANT SELECT ON public.pickleball_awards TO anon,authenticated;

REVOKE ALL ON FUNCTION public.pickleball_admin_lock(uuid,integer),public.pickleball_match_history(),
 public.pickleball_reset_downstream(uuid,uuid[],boolean),public.pickleball_reconcile(uuid),
 public.pickleball_write_prizes(uuid,text,numeric,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_record_pickleball_result(uuid,integer,integer,boolean,text,boolean,integer),
 public.move_pickleball_slot(uuid,text,uuid,text,text,boolean,integer),
 public.manage_pickleball_team(uuid,uuid,text,text,text,text,text,text,boolean,integer),
 public.save_pickleball_prizes(uuid,text,numeric,jsonb,integer),
 public.save_pickleball_event(uuid,text,text,text,timestamptz,integer,integer,text,boolean,text,numeric,jsonb,integer)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_record_pickleball_result(uuid,integer,integer,boolean,text,boolean,integer),
 public.move_pickleball_slot(uuid,text,uuid,text,text,boolean,integer),
 public.manage_pickleball_team(uuid,uuid,text,text,text,text,text,text,boolean,integer),
 public.save_pickleball_prizes(uuid,text,numeric,jsonb,integer),
 public.save_pickleball_event(uuid,text,text,text,timestamptz,integer,integer,text,boolean,text,numeric,jsonb,integer)
 TO authenticated;

-- Rebuild read-only final placements for previously completed single-elimination events.
DO $$ DECLARE e record;t text; BEGIN
 FOR e IN SELECT id FROM public.pickleball_tournaments WHERE status IN('in_progress','completed') LOOP
 PERFORM public.pickleball_reconcile(e.id);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['pickleball_prizes','pickleball_results'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
 EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
 END IF;
 END LOOP;
END; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
