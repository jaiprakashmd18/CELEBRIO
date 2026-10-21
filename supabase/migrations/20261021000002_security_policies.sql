-- Celebrio — Row Level Security
--
-- Principles:
--   * RLS is enabled on every table in the public schema.
--   * Customers can only read/write their own rows.
--   * Nobody can mark an order paid or grant an entitlement from the browser:
--     those tables have no write policies at all, and are changed only by
--     the security-definer payment functions, which only the service role
--     (server-side code) may execute.
--   * Admin access is derived from the admin_users table via is_admin(),
--     never from anything the browser sends.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.projects enable row level security;
alter table public.project_assets enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.entitlements enable row level security;
alter table public.export_jobs enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.support_requests enable row level security;
alter table public.rate_limits enable row level security;

-- Profiles -------------------------------------------------------------------
create policy "profiles: owner reads" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: owner updates" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path, preferred_currency) on public.profiles to authenticated;

-- Admin users: a user may check whether they themselves are an admin. -------
create policy "admin_users: self or admin reads" on public.admin_users
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Categories -----------------------------------------------------------------
create policy "categories: public reads active" on public.categories
  for select to anon, authenticated using (is_active or public.is_admin());
create policy "categories: admin inserts" on public.categories
  for insert to authenticated with check (public.is_admin());
create policy "categories: admin updates" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "categories: admin deletes" on public.categories
  for delete to authenticated using (public.is_admin());

-- Templates ------------------------------------------------------------------
create policy "templates: public reads published" on public.templates
  for select to anon, authenticated using ((is_published and not is_archived) or public.is_admin());
create policy "templates: admin inserts" on public.templates
  for insert to authenticated with check (public.is_admin());
create policy "templates: admin updates" on public.templates
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- No delete policy: templates are archived, never deleted, because orders reference them.

create policy "template_versions: readable with template" on public.template_versions
  for select to anon, authenticated using (
    public.is_admin()
    or exists (select 1 from public.templates t where t.id = template_id and t.is_published and not t.is_archived)
    or exists (select 1 from public.projects p where p.template_id = template_versions.template_id and p.owner_id = auth.uid())
  );

-- Projects -------------------------------------------------------------------
create policy "projects: owner reads" on public.projects
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "projects: owner inserts" on public.projects
  for insert to authenticated with check (owner_id = auth.uid() and status = 'draft');
create policy "projects: owner updates" on public.projects
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "projects: owner deletes" on public.projects
  for delete to authenticated using (owner_id = auth.uid());
-- Customers may change content but never ownership or purchase status.
revoke update on public.projects from authenticated;
grant update (title, editor_mode, project_data, revision, template_version) on public.projects to authenticated;

-- Project assets ---------------------------------------------------------------
create policy "project_assets: owner reads" on public.project_assets
  for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "project_assets: owner deletes" on public.project_assets
  for delete to authenticated using (owner_id = auth.uid());
-- Inserts happen server-side after the upload has been validated and re-encoded.

-- Orders, events, entitlements, exports: read-only for their owners ----------
create policy "orders: owner reads" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "order_events: admin reads" on public.order_events
  for select to authenticated using (public.is_admin());
create policy "entitlements: owner reads" on public.entitlements
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "export_jobs: owner reads" on public.export_jobs
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Audit log --------------------------------------------------------------------
create policy "audit: admin reads" on public.admin_audit_logs
  for select to authenticated using (public.is_admin());
create policy "audit: admin writes own entries" on public.admin_audit_logs
  for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());

-- Support requests ---------------------------------------------------------------
create policy "support: owner or admin reads" on public.support_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "support: admin updates" on public.support_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke update on public.support_requests from authenticated;
grant update (status, admin_note) on public.support_requests to authenticated;

-- payment_webhook_events and rate_limits intentionally have no policies:
-- only the service role (which bypasses RLS) can touch them.
