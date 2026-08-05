revoke all on table public.user_notification_preferences from public, anon, authenticated;
grant select, insert, update on table public.user_notification_preferences to authenticated;

revoke all on function public.get_notifications_page(text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.delete_notifications(uuid[]) from public, anon;
grant execute on function public.get_notifications_page(text, integer, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated, service_role;
grant execute on function public.delete_notifications(uuid[]) to authenticated, service_role;
