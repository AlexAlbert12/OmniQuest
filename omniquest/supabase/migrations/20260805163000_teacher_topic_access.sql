revoke all on table public.subject_topics from public, anon, authenticated;
grant select on table public.subject_topics to authenticated;
grant select, insert, update, delete on table public.subject_topics to service_role;

revoke all on sequence public.subject_topics_id_seq from public, anon, authenticated;
grant usage, select on sequence public.subject_topics_id_seq to service_role;
