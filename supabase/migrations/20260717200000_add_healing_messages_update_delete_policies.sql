-- Allow users to update their own healing messages, forcing status to 'pending'
drop policy if exists "healing_messages_update_own" on public.healing_messages;
create policy "healing_messages_update_own" on public.healing_messages
for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid() and status = 'pending');

-- Allow users to delete their own healing messages
drop policy if exists "healing_messages_delete_own" on public.healing_messages;
create policy "healing_messages_delete_own" on public.healing_messages
for delete to authenticated
using (author_id = auth.uid());
