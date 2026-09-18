-- Clase Graduanda PR - Mini nube Supabase
-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.
-- Los datos reales del colegio llegan cifrados desde el navegador.
-- La tabla no se expone directamente a anon/authenticated; solo mediante dos RPC.

create table if not exists public.clase_graduanda_backups (
  college_id text primary key,
  payload text not null,
  updated_at timestamptz not null default now()
);

alter table public.clase_graduanda_backups enable row level security;

revoke all on table public.clase_graduanda_backups from anon, authenticated;

create or replace function public.save_graduanda_backup(
  p_college_id text,
  p_payload text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clase_graduanda_backups(college_id, payload, updated_at)
  values (p_college_id, p_payload, now())
  on conflict (college_id)
  do update set
    payload = excluded.payload,
    updated_at = now();
end;
$$;

create or replace function public.load_graduanda_backup(
  p_college_id text
)
returns table(payload text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select b.payload, b.updated_at
  from public.clase_graduanda_backups b
  where b.college_id = p_college_id
  limit 1;
$$;

revoke all on function public.save_graduanda_backup(text,text) from public;
revoke all on function public.load_graduanda_backup(text) from public;

grant execute on function public.save_graduanda_backup(text,text) to anon, authenticated;
grant execute on function public.load_graduanda_backup(text) to anon, authenticated;
