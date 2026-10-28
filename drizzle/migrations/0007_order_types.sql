BEGIN;

-- Existing orders remain deliveries; their original fees and totals are preserved.
ALTER TABLE public.orders
  ADD COLUMN order_type text NOT NULL DEFAULT 'delivery',
  ADD CONSTRAINT orders_order_type CHECK (order_type IN ('delivery', 'counter')),
  ADD CONSTRAINT orders_counter_fulfillment CHECK (
    order_type <> 'counter' OR (
      rider_id IS NULL AND delivery_fee = 0 AND proof_of_delivery_path IS NULL
      AND status <> 'picked_up'
    )
  );

-- Replace the old signature to avoid PostgREST overload ambiguity. The default
-- keeps six-argument callers working as deliveries during rollout.
DROP FUNCTION public.place_order(jsonb, text, text, text, text, text);
CREATE FUNCTION public.place_order(
  _items jsonb, _address text, _phone text, _name text, _notes text,
  _payment text, _order_type text DEFAULT 'delivery'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order uuid;
  _total numeric := 0;
  _it jsonb;
  _m record;
  _fee numeric;
  _quantity int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _order_type IS NULL OR _order_type NOT IN ('delivery', 'counter') THEN
    RAISE EXCEPTION 'Invalid order type';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF _payment IS NULL OR NOT (
    (_order_type = 'delivery' AND _payment = 'cod') OR
    (_order_type = 'counter' AND _payment IN ('cod', 'counter'))
  ) THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
  IF nullif(btrim(_phone), '') IS NULL OR nullif(btrim(_name), '') IS NULL THEN
    RAISE EXCEPTION 'Name and phone are required';
  END IF;
  IF _order_type = 'delivery' AND nullif(btrim(_address), '') IS NULL THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;

  _fee := CASE WHEN _order_type = 'delivery' THEN 49 ELSE 0 END;
  INSERT INTO public.orders (
    customer_id, address, phone, customer_name, notes, payment_method, delivery_fee, order_type
  ) VALUES (
    auth.uid(), CASE WHEN _order_type = 'counter' THEN 'Counter Pickup / Walk-in' ELSE _address END,
    _phone, _name, _notes, CASE WHEN _order_type = 'counter' THEN 'counter' ELSE 'cod' END,
    _fee, _order_type
  ) RETURNING id INTO _order;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _m FROM public.menu_items WHERE id = (_it->>'id')::uuid AND available;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable'; END IF;
    -- Preserve the original minimum quantity of one and use database prices.
    _quantity := greatest(1, (_it->>'quantity')::int);
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity)
    VALUES (_order, _m.id, _m.name, _m.price, _quantity);
    _total := _total + _m.price * _quantity;
  END LOOP;
  UPDATE public.orders SET total = _total + _fee WHERE id = _order;
  RETURN _order;
END; $$;
REVOKE ALL ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, text) TO authenticated;

-- Customers and admins retain access; riders only see delivery work.
ALTER POLICY "orders read" ON public.orders TO authenticated USING (
  customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR (
    order_type = 'delivery' AND public.has_role(auth.uid(), 'rider') AND
    (rider_id = auth.uid() OR (rider_id IS NULL AND status = 'ready'))
  )
);
CREATE OR REPLACE FUNCTION public.rider_accept_order(_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'rider') THEN RAISE EXCEPTION 'Not a rider'; END IF;
  IF NOT public.has_rider_photo(auth.uid()) THEN RAISE EXCEPTION 'Upload your profile picture before accepting orders'; END IF;
  UPDATE public.orders SET rider_id = auth.uid(), updated_at = now()
  WHERE id = _order AND order_type = 'delivery' AND rider_id IS NULL AND status = 'ready';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable for delivery'; END IF;
END; $$;

-- A delivery cannot be reclassified to evade its original proof requirements.
-- Counter completion is the intentional exception: admin confirms collection
-- from the ready state without dispatching a rider or uploading delivery proof.
CREATE OR REPLACE FUNCTION public.require_delivery_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
BEGIN
  IF NEW.order_type IS DISTINCT FROM OLD.order_type THEN RAISE EXCEPTION 'Order type cannot be changed'; END IF;
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    IF NEW.order_type = 'counter' THEN
      IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required to claim counter orders'; END IF;
      IF OLD.status <> 'ready' THEN RAISE EXCEPTION 'Prepare the order before marking it claimed'; END IF;
    ELSE
      IF OLD.status <> 'picked_up' THEN RAISE EXCEPTION 'Pick up the order before marking it delivered'; END IF;
      IF NEW.rider_id IS NULL OR NEW.proof_of_delivery_path IS NULL OR NOT EXISTS (
        SELECT 1 FROM storage.objects s WHERE s.bucket_id = 'delivery-proofs'
        AND s.name = NEW.proof_of_delivery_path AND split_part(s.name, '/', 1) = NEW.rider_id::text
        AND split_part(s.name, '/', 2) = NEW.id::text
      ) THEN RAISE EXCEPTION 'Upload a delivery proof photo before marking this order delivered'; END IF;
    END IF;
  END IF;
  IF OLD.status = 'delivered' AND (
    NEW.proof_of_delivery_path IS DISTINCT FROM OLD.proof_of_delivery_path OR
    NEW.rider_id IS DISTINCT FROM OLD.rider_id
  ) THEN RAISE EXCEPTION 'Delivered order proof cannot be changed'; END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.admin_claim_counter_order(_order uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
  UPDATE public.orders SET status = 'delivered', updated_at = now()
  WHERE id = _order AND order_type = 'counter' AND status = 'ready';
  IF NOT FOUND THEN RAISE EXCEPTION 'Counter order must be ready before collection'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_claim_counter_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_claim_counter_order(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
