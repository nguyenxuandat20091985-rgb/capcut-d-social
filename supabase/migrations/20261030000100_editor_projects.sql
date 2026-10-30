-- D-Social Studio cloud project persistence
-- Apply with Supabase SQL Editor or: supabase db push

create table if not exists public.projects (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Project',
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

create table if not exists public.project_assets (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('video', 'audio', 'image')),
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists project_assets_project_idx
  on public.project_assets (owner_id, project_id);

alter table public.projects enable row level security;
alter table public.project_assets enable row level security;

drop policy if exists "Users manage their own projects" on public.projects;
create policy "Users manage their own projects"
  on public.projects for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Users manage their own project assets" on public.project_assets;
create policy "Users manage their own project assets"
  on public.project_assets for all to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_assets.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_assets.project_id
        and p.owner_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  false,
  524288000,
  array['video/mp4','video/quicktime','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/aac','image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own editor assets" on storage.objects;
create policy "Users upload their own editor assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read their own editor assets" on storage.objects;
create policy "Users read their own editor assets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own editor assets" on storage.objects;
create policy "Users update their own editor assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own editor assets" on storage.objects;
create policy "Users delete their own editor assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_projects_updated_at();
