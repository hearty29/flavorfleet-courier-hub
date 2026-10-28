BEGIN;

-- A deletion is personal inbox state. Shared conversations/messages are retained.
CREATE TABLE public.support_inbox_deletions (
 conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (conversation_id, user_id)
);
ALTER TABLE public.support_inbox_deletions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.support_inbox_deletions TO authenticated;
GRANT ALL ON public.support_inbox_deletions TO service_role;
CREATE POLICY support_inbox_deletions_own ON public.support_inbox_deletions
 FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.can_access_support(conversation_id));

CREATE FUNCTION public.delete_support_conversation(_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Chat access denied'; END IF;
 -- Serialize with message preparation and explicit reopening. A message that
 -- follows this deletion restores the thread; one that precedes it is hidden.
 PERFORM 1 FROM public.support_conversations WHERE id=_conversation FOR UPDATE;
 IF NOT FOUND OR NOT public.can_access_support(_conversation) THEN RAISE EXCEPTION 'Chat access denied'; END IF;
 INSERT INTO public.support_inbox_deletions(conversation_id,user_id)
 VALUES (_conversation,auth.uid())
 ON CONFLICT (conversation_id,user_id) DO UPDATE SET deleted_at=clock_timestamp();
END; $$;
REVOKE ALL ON FUNCTION public.delete_support_conversation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_support_conversation(uuid) TO authenticated;

-- Message preparation already locks the conversation row. Clear hidden state in
-- the same transaction as the insert, so other participants and concurrent sends
-- cannot lose a new conversation notification.
CREATE FUNCTION public.restore_support_inboxes_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 DELETE FROM public.support_inbox_deletions WHERE conversation_id=NEW.conversation_id;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.restore_support_inboxes_on_message() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER support_message_restore_inboxes AFTER INSERT ON public.support_messages
 FOR EACH ROW EXECUTE FUNCTION public.restore_support_inboxes_on_message();

CREATE OR REPLACE FUNCTION public.open_support_conversation(_kind text,_order uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 DELETE FROM public.support_inbox_deletions WHERE conversation_id=result AND user_id=auth.uid();
 RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.list_support_conversations() RETURNS TABLE(id uuid,kind text,order_id uuid,status text,updated_at timestamptz,display_name text,last_message text,unread boolean) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT c.id,c.kind,c.order_id,c.status,c.updated_at,
 COALESCE((SELECT nullif(btrim(a.full_name),'') FROM rider_applications a WHERE a.user_id=c.owner_id AND a.status='approved' ORDER BY a.created_at DESC LIMIT 1),(SELECT nullif(btrim(p.full_name),'') FROM profiles p WHERE p.id=c.owner_id),(SELECT nullif(btrim(o.customer_name),'') FROM orders o WHERE o.customer_id=c.owner_id ORDER BY o.created_at DESC LIMIT 1),CASE WHEN c.kind='rider_admin' THEN 'Rider' ELSE 'Customer' END),
 m.body,EXISTS(SELECT 1 FROM support_messages n WHERE n.conversation_id=c.id AND n.sender_id<>auth.uid() AND n.created_at>COALESCE(r.read_at,'-infinity'::timestamptz))
 FROM support_conversations c LEFT JOIN support_reads r ON r.conversation_id=c.id AND r.user_id=auth.uid()
 LEFT JOIN LATERAL (SELECT body FROM support_messages WHERE conversation_id=c.id ORDER BY created_at DESC,id DESC LIMIT 1) m ON true
 WHERE can_access_support(c.id) AND NOT EXISTS (
 SELECT 1 FROM public.support_inbox_deletions d WHERE d.conversation_id=c.id AND d.user_id=auth.uid()
 ) ORDER BY c.updated_at DESC;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
