select normalized_code, count(*)
from (
  select upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) as normalized_code
  from public.subjects
  where code is not null

  union all

  select upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) as normalized_code
  from public.classrooms
  where code is not null
) codes
where normalized_code <> ''
group by normalized_code
having count(*) > 1;