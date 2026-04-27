insert into public.roles (id, name)
values ('guest', 'Guest')
on conflict (id) do update
set name = excluded.name;
