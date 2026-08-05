revoke all on table public.profiles, public.notification_state from public, anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.notification_state to authenticated;

revoke all on sequence public.notification_state_id_seq from public, anon, authenticated;
grant usage, select on sequence public.notification_state_id_seq to authenticated;
