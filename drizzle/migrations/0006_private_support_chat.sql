CREATE TABLE public.support_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('customer_admin','rider_admin','order_rider')),
 owner_id uuid NOT NULL,
 order_id uuid REFERENCES public.orders(id),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind = 'order_rider') = (order_id IS NOT NULL))
);
GRANT SELECT ON public.support_conversations TO authenticated;
GRANT ALL ON public.support_conversations TO service_role;
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX support_owner_kind ON public.support_conversations(owner_id,kind) WHERE order_id IS NULL;
CREATE UNIQUE INDEX support_order_unique ON public.support_conversations(order_id) WHERE order_id IS NOT NULL;
CREATE FUNCTION public.can_access_support(_conversation uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM support_conversations c WHERE c.id=_conversation AND (
 has_role(auth.uid(),'admin') OR
 (c.kind <> 'order_rider' AND c.owner_id=auth.uid()) OR
 (c.kind='order_rider' AND EXISTS (SELECT 1 FROM orders o WHERE o.id=c.order_id AND (o.customer_id=auth.uid() OR o.rider_id=auth.uid())))
 ));
$$;
REVOKE ALL ON FUNCTION public.can_access_support(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_support(uuid) TO authenticated, service_role;
CREATE POLICY support_participants_read ON public.support_conversations FOR SELECT TO authenticated USING (public.can_access_support(id));
CREATE TABLE public.support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES public.support_conversations(id),
 sender_id uuid NOT NULL DEFAULT auth.uid(),
 sender_name text NOT NULL DEFAULT '',
 sender_role text NOT NULL DEFAULT '',
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX support_message_thread ON public.support_messages(conversation_id,created_at,id);
CREATE POLICY support_messages_read ON public.support_messages FOR SELECT TO authenticated USING (public.can_access_support(conversation_id));
CREATE POLICY support_messages_send ON public.support_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND public.can_access_support(conversation_id));
CREATE TABLE public.support_reads (
 conversation_id uuid NOT NULL REFERENCES public.support_conversations(id),
 user_id uuid NOT NULL,
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(conversation_id,user_id)
);
GRANT SELECT ON public.support_reads TO authenticated;
GRANT ALL ON public.support_reads TO service_role;
ALTER TABLE public.support_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_reads_own ON public.support_reads FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE FUNCTION public.prepare_support_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT can_access_support(NEW.conversation_id) THEN RAISE EXCEPTION 'You cannot send messages to this conversation'; END IF;
 NEW.sender_id:=auth.uid(); NEW.body:=btrim(NEW.body); NEW.created_at:=clock_timestamp();
 NEW.sender_role:=CASE WHEN has_role(auth.uid(),'admin') THEN 'admin' WHEN has_role(auth.uid(),'rider') THEN 'rider' ELSE 'customer' END;
 SELECT COALESCE((SELECT nullif(btrim(a.full_name),'') FROM rider_applications a WHERE a.user_id=auth.uid() AND a.status='approved' ORDER BY a.created_at DESC LIMIT 1),(SELECT nullif(btrim(p.full_name),'') FROM profiles p WHERE p.id=auth.uid()),(SELECT nullif(btrim(o.customer_name),'') FROM orders o WHERE o.customer_id=auth.uid() ORDER BY o.created_at DESC LIMIT 1),initcap(NEW.sender_role)) INTO NEW.sender_name;
 UPDATE support_conversations SET status='open',updated_at=NEW.created_at WHERE id=NEW.conversation_id;
 RETURN NEW;
END; $$;
CREATE TRIGGER support_message_prepare BEFORE INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.prepare_support_message();
CREATE FUNCTION public.open_support_conversation(_kind text,_order uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid; owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to chat'; END IF;
 IF _kind='order_rider' THEN
 SELECT customer_id INTO owner FROM orders WHERE id=_order AND rider_id IS NOT NULL AND (customer_id=auth.uid() OR rider_id=auth.uid() OR has_role(auth.uid(),'admin'));
 IF owner IS NULL THEN RAISE EXCEPTION 'An assigned rider is required for this order chat'; END IF;
 INSERT INTO support_conversations(kind,owner_id,order_id) VALUES (_kind,owner,_order) ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO UPDATE SET order_id=EXCLUDED.order_id RETURNING id INTO result;
 ELSE
 IF _kind NOT IN ('customer_admin','rider_admin') OR _order IS NOT NULL THEN RAISE EXCEPTION 'Invalid chat type'; END IF;
 IF _kind='rider_admin' AND NOT (has_role(auth.uid(),'rider') OR has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Rider access required'; END IF;
 INSERT INTO support_conversations(kind,owner_id) VALUES (_kind,auth.uid()) ON CONFLICT (owner_id,kind) WHERE order_id IS NULL DO UPDATE SET owner_id=EXCLUDED.owner_id RETURNING id INTO result;
 END IF;
 RETURN result;
END; $$;
CREATE FUNCTION public.mark_support_read(_conversation uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT can_access_support(_conversation) THEN RAISE EXCEPTION 'Chat access denied'; END IF;
 INSERT INTO support_reads(conversation_id,user_id,read_at) VALUES (_conversation,auth.uid(),clock_timestamp()) ON CONFLICT(conversation_id,user_id) DO UPDATE SET read_at=EXCLUDED.read_at;
END; $$;
CREATE FUNCTION public.resolve_support_conversation(_conversation uuid,_resolved boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required'; END IF;
 UPDATE support_conversations SET status=CASE WHEN _resolved THEN 'resolved' ELSE 'open' END WHERE id=_conversation;
END; $$;
CREATE FUNCTION public.list_support_conversations() RETURNS TABLE(id uuid,kind text,order_id uuid,status text,updated_at timestamptz,display_name text,last_message text,unread boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.kind,c.order_id,c.status,c.updated_at,
 COALESCE((SELECT nullif(btrim(a.full_name),'') FROM rider_applications a WHERE a.user_id=c.owner_id AND a.status='approved' ORDER BY a.created_at DESC LIMIT 1),(SELECT nullif(btrim(p.full_name),'') FROM profiles p WHERE p.id=c.owner_id),(SELECT nullif(btrim(o.customer_name),'') FROM orders o WHERE o.customer_id=c.owner_id ORDER BY o.created_at DESC LIMIT 1),CASE WHEN c.kind='rider_admin' THEN 'Rider' ELSE 'Customer' END),
 m.body,EXISTS(SELECT 1 FROM support_messages n WHERE n.conversation_id=c.id AND n.sender_id<>auth.uid() AND n.created_at>COALESCE(r.read_at,'-infinity'::timestamptz))
 FROM support_conversations c LEFT JOIN support_reads r ON r.conversation_id=c.id AND r.user_id=auth.uid()
 LEFT JOIN LATERAL (SELECT body FROM support_messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) m ON true
 WHERE can_access_support(c.id) ORDER BY c.updated_at DESC;
$$;
REVOKE ALL ON FUNCTION public.open_support_conversation(text,uuid),public.mark_support_read(uuid),public.resolve_support_conversation(uuid,boolean),public.list_support_conversations() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_support_conversation(text,uuid),public.mark_support_read(uuid),public.resolve_support_conversation(uuid,boolean),public.list_support_conversations() TO authenticated,service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations,public.support_messages;