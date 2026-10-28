\set ON_ERROR_STOP on
-- Empty disposable local database only; baseline creates synthetic auth/storage.
\ir test-order-types.sql
\ir ../drizzle/migrations/0008_pickleball_tournaments.sql
\ir ../drizzle/migrations/0009_personal_inbox_deletion.sql

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT open_support_conversation('customer_admin') AS customer_chat \gset
SELECT open_support_conversation('order_rider', :'delivery_id') AS order_chat \gset
INSERT INTO support_messages(conversation_id,body) VALUES (:'customer_chat','Original message');
SELECT delete_support_conversation(:'customer_chat');
SELECT delete_support_conversation(:'customer_chat');
SELECT test_assert(count(*)=0,'customer hides their inbox entry idempotently') FROM list_support_conversations() WHERE id=:'customer_chat';
SELECT test_assert(count(*)=1,'customer retains message history') FROM support_messages WHERE conversation_id=:'customer_chat';
SELECT test_assert(count(*)=1,'customer sees own deletion state') FROM support_inbox_deletions;
SELECT test_reject(format('DELETE FROM support_messages WHERE conversation_id=%L',:'customer_chat'),'permission denied');
SELECT test_reject(format('DELETE FROM support_conversations WHERE id=%L',:'customer_chat'),'permission denied');
SELECT test_reject(format('INSERT INTO support_inbox_deletions(conversation_id,user_id) VALUES (%L,%L)',:'customer_chat','00000000-0000-0000-0000-000000000001'),'permission denied');
SELECT test_reject('SELECT restore_support_inboxes_on_message()','permission denied');

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT test_assert(count(*)=1,'customer deletion does not hide admin entry') FROM list_support_conversations() WHERE id=:'customer_chat';
SELECT test_assert(count(*)=0,'admin cannot read another account deletion state') FROM support_inbox_deletions;
SELECT delete_support_conversation(:'customer_chat');
SELECT test_assert(count(*)=0,'admin hides own entry') FROM list_support_conversations() WHERE id=:'customer_chat';

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
SELECT test_reject(format('SELECT delete_support_conversation(%L)',:'customer_chat'),'Chat access denied');
SELECT test_reject($q$SELECT delete_support_conversation('ffffffff-ffff-ffff-ffff-ffffffffffff')$q$,'Chat access denied');
SELECT test_assert(count(*)=0,'outsider sees no private messages') FROM support_messages WHERE conversation_id=:'customer_chat';
SELECT test_assert(count(*)=0,'outsider sees no deletion states') FROM support_inbox_deletions;

SET ROLE anon;
SELECT test_reject(format('SELECT delete_support_conversation(%L)',:'customer_chat'),'permission denied');
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claim.sub = '';
SELECT test_reject(format('SELECT delete_support_conversation(%L)',:'customer_chat'),'Chat access denied');

-- New messages restore every personal inbox and preserve existing read behavior.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
INSERT INTO support_messages(conversation_id,body,sender_id,sender_name,sender_role)
VALUES (:'customer_chat','New reply','00000000-0000-0000-0000-000000000004','Spoofed','rider');
SELECT test_assert(count(*)=1,'new reply restores admin inbox') FROM list_support_conversations() WHERE id=:'customer_chat';
SELECT test_assert(sender_id=auth.uid() AND sender_role='admin' AND sender_name<>'Spoofed','sender identity still stamped') FROM support_messages WHERE body='New reply';
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT test_assert(count(*)=1 AND bool_and(unread),'new reply restores customer inbox and unread badge') FROM list_support_conversations() WHERE id=:'customer_chat';
SELECT test_assert(count(*)=2,'original and new messages retained') FROM support_messages WHERE conversation_id=:'customer_chat';
SELECT mark_support_read(:'customer_chat');
SELECT test_assert(NOT unread,'mark read unaffected') FROM list_support_conversations() WHERE id=:'customer_chat';

-- Explicit reopening restores only the caller; status changes alone do not restore.
SELECT delete_support_conversation(:'customer_chat');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT delete_support_conversation(:'customer_chat');
SELECT resolve_support_conversation(:'customer_chat',true);
SELECT test_assert(count(*)=0,'resolving does not restore hidden thread') FROM list_support_conversations() WHERE id=:'customer_chat';
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT test_assert(open_support_conversation('customer_admin')=:'customer_chat','reopen reuses original conversation');
SELECT test_assert(count(*)=1 AND bool_and(status='resolved'),'explicit reopen restores personal entry without changing status') FROM list_support_conversations() WHERE id=:'customer_chat';
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT test_assert(count(*)=0,'customer reopening does not restore admin inbox') FROM list_support_conversations() WHERE id=:'customer_chat';

-- Rider support and order chat share the same personal deletion behavior.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT open_support_conversation('rider_admin') AS rider_chat \gset
SELECT delete_support_conversation(:'rider_chat');
SELECT test_assert(count(*)=0,'rider hides own support thread') FROM list_support_conversations() WHERE id=:'rider_chat';
SELECT test_assert(open_support_conversation('rider_admin')=:'rider_chat','rider can reopen own support thread');
SELECT delete_support_conversation(:'order_chat');
SELECT test_assert(count(*)=0,'assigned rider hides order chat') FROM list_support_conversations() WHERE id=:'order_chat';
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT test_assert(count(*)=1,'rider deletion preserves customer order chat') FROM list_support_conversations() WHERE id=:'order_chat';
SELECT delete_support_conversation(:'order_chat');
SELECT test_assert(open_support_conversation('order_rider',:'delivery_id')=:'order_chat','customer reopening preserves order chat identity');
INSERT INTO support_messages(conversation_id,body) VALUES (:'order_chat','Order follow-up');
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT test_assert(count(*)=1,'new order message restores rider inbox') FROM list_support_conversations() WHERE id=:'order_chat';

-- Reassignment must revoke old rider access even if they had a deletion marker.
SELECT delete_support_conversation(:'order_chat');
RESET ROLE;
-- Test fixture update bypasses delivered order immutability; not an application action.
ALTER TABLE orders DISABLE TRIGGER USER;
UPDATE orders SET rider_id=NULL WHERE id=:'delivery_id';
ALTER TABLE orders ENABLE TRIGGER USER;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT test_reject(format('SELECT delete_support_conversation(%L)',:'order_chat'),'Chat access denied');
SELECT test_reject(format('SELECT open_support_conversation(%L,%L)','order_rider',:'delivery_id'),'assigned rider');
SELECT test_assert(count(*)=0,'former rider cannot list order chat') FROM list_support_conversations() WHERE id=:'order_chat';
SELECT test_assert(count(*)=0,'former rider cannot see old deletion state') FROM support_inbox_deletions WHERE conversation_id=:'order_chat';
SELECT test_assert(count(*)=0,'former rider cannot read messages') FROM support_messages WHERE conversation_id=:'order_chat';
RESET ROLE;
\echo 'Personal inbox deletion SQL checks passed'
