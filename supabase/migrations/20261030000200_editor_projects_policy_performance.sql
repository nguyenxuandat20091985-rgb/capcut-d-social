-- Tighten project editor policies and indexes based on Supabase advisor findings.

create index if not exists project_assets_project_id_idx
  on public.project_assets (project_id);

drop policy if exists "Users manage their own projects" on public.projects;
create policy "Users manage their own projects"
  on public.projects for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Users manage their own project assets" on public.project_assets;
create policy "Users manage their own project assets"
  on public.project_assets for all to authenticated
  using (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = project_assets.project_id
        and p.owner_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.projects p
      where p.id = project_assets.project_id
        and p.owner_id = (select auth.uid())
    )
  );

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
