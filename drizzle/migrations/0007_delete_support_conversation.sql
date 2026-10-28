create or replace function public.delete_support_conversation(_conversation uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.uid() is null or not public.can_access_support(_conversation) then
    raise exception 'You cannot delete this conversation';
  end if;
  delete from public.support_reads where conversation_id = _conversation;
  delete from public.support_messages where conversation_id = _conversation;
  delete from public.support_conversations where id = _conversation;
  if not found then raise exception 'Conversation not found'; end if;
end;
$$;

grant execute on function public.delete_support_conversation(uuid) to authenticated;
grant execute on function public.delete_support_conversation(uuid) to service_role;