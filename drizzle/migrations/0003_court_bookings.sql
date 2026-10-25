CREATE TABLE public.court_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id text NOT NULL,
  booking_date date NOT NULL,
  time_slot text NOT NULL,
  player_name text NOT NULL,
  player_contact text NOT NULL,
  paddles int NOT NULL DEFAULT 0,
  balls boolean NOT NULL DEFAULT false,
  total int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (court_id, booking_date, time_slot)
);
GRANT SELECT, UPDATE, DELETE ON public.court_bookings TO authenticated;
GRANT ALL ON public.court_bookings TO service_role;
ALTER TABLE public.court_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage court bookings" ON public.court_bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_booked_slots(_court text, _date date)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT time_slot FROM public.court_bookings WHERE court_id = _court AND booking_date = _date
$$;

CREATE OR REPLACE FUNCTION public.book_court(_court text, _date date, _slot text, _name text, _contact text, _paddles int, _balls boolean, _total int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF _court NOT IN ('court-1','court-2','court-3','court-4') THEN RAISE EXCEPTION 'Invalid court'; END IF;
  IF _date < current_date THEN RAISE EXCEPTION 'Date is in the past'; END IF;
  IF length(trim(_name)) = 0 OR length(trim(_contact)) = 0 OR length(_name) > 100 OR length(_contact) > 30 THEN RAISE EXCEPTION 'Invalid name or contact'; END IF;
  IF _paddles < 0 OR _paddles > 8 THEN RAISE EXCEPTION 'Invalid paddles'; END IF;
  INSERT INTO public.court_bookings(court_id, booking_date, time_slot, player_name, player_contact, paddles, balls, total)
  VALUES (_court, _date, _slot, trim(_name), trim(_contact), _paddles, _balls, _total) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This time slot is already booked';
END $$;

GRANT EXECUTE ON FUNCTION public.get_booked_slots(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_court(text, date, text, text, text, int, boolean, int) TO anon, authenticated;