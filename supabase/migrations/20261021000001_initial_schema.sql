-- Celebrio — initial schema
-- Tables, constraints, indexes and housekeeping triggers.
-- Row Level Security policies live in the next migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user, created automatically on sign-up)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 300),
  preferred_currency char(3) not null default 'INR' check (preferred_currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Administrators. Rows can only be created with the service role or the SQL
-- editor (see README "Bootstrapping the first administrator").
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  note text check (note is null or char_length(note) <= 200)
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  description text check (description is null or char_length(description) <= 400),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  description text not null default '' check (char_length(description) <= 600),
  tags text[] not null default '{}',
  style text not null default 'classic' check (style in ('classic', 'modern', 'playful', 'romantic', 'minimal', 'bold')),
  color_family text not null default 'neutral' check (color_family in ('warm', 'cool', 'dark', 'pastel', 'neutral')),
  preview_path text check (preview_path is null or char_length(preview_path) <= 300),
  template_definition jsonb not null,
  supported_formats text[] not null check (
    cardinality(supported_formats) between 1 and 3
    and supported_formats <@ array['portrait', 'square', 'landscape']::text[]
  ),
  aspect_ratio text not null check (aspect_ratio in ('9:16', '1:1', '16:9')),
  -- Amounts are integer minor units (paise for INR). No implicit conversion.
  price_amount integer not null check (price_amount >= 0 and price_amount <= 10000000),
  multi_format_price_amount integer check (multi_format_price_amount is null or multi_format_price_amount >= 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  is_free boolean not null default false,
  is_published boolean not null default false,
  is_archived boolean not null default false,
  version integer not null default 1 check (version >= 1),
  use_count integer not null default 0 check (use_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint templates_free_is_zero check (not is_free or price_amount = 0),
  constraint templates_archived_not_published check (not (is_archived and is_published))
);
create index templates_category_idx on public.templates (category_id);
create index templates_published_idx on public.templates (is_published, is_archived, created_at desc);
create index templates_tags_idx on public.templates using gin (tags);
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates (id) on delete cascade,
  version integer not null check (version >= 1),
  definition jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

-- ---------------------------------------------------------------------------
-- Customer projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.templates (id) on delete restrict,
  template_version integer not null check (template_version >= 1),
  title text not null default 'Untitled invitation' check (char_length(title) between 1 and 100),
  editor_mode text not null default 'auto' check (editor_mode in ('auto', 'advanced')),
  project_data jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'purchased', 'archived')),
  -- Incremented on every save; used to detect edits from another tab.
  revision integer not null default 1 check (revision >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_data_size check (pg_column_size(project_data) < 200000)
);
create index projects_owner_idx on public.projects (owner_id, updated_at desc);
create index projects_template_idx on public.projects (template_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size integer not null check (file_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now()
);
create index project_assets_owner_idx on public.project_assets (owner_id);
create index project_assets_project_idx on public.project_assets (project_id);

-- ---------------------------------------------------------------------------
-- Orders, entitlements and payment audit trail
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Kept (set null) when an account is deleted so financial records survive.
  user_id uuid references auth.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  template_id uuid references public.templates (id) on delete set null,
  package text not null check (package in ('single_format', 'multi_format')),
  amount_minor integer not null check (amount_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunded', 'disputed')),
  provider text not null check (provider in ('stripe', 'razorpay', 'simulator', 'free')),
  provider_checkout_id text,
  provider_payment_reference text,
  -- Hosted checkout URL, reused if the customer returns within the session lifetime.
  checkout_url text check (checkout_url is null or char_length(checkout_url) <= 1000),
  checkout_expires_at timestamptz,
  entitlement_snapshot jsonb not null,
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz,
  unique (provider, provider_checkout_id)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_project_idx on public.orders (project_id);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_payment_ref_idx on public.orders (provider, provider_payment_reference);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  source text not null check (source in ('checkout', 'webhook', 'admin', 'system')),
  provider_event_id text,
  actor_id uuid references auth.users (id) on delete set null,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- Each provider event is processed at most once (idempotency).
create table public.payment_webhook_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text,
  primary key (provider, event_id)
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  -- One entitlement per order: a duplicate webhook can never grant twice.
  order_id uuid not null unique references public.orders (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  allowed_formats text[] not null check (allowed_formats <@ array['portrait', 'square', 'landscape']::text[]),
  allowed_file_types text[] not null default array['png', 'jpeg', 'pdf'] check (allowed_file_types <@ array['png', 'jpeg', 'pdf']::text[]),
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index entitlements_project_idx on public.entitlements (project_id, status);
create index entitlements_user_idx on public.entitlements (user_id);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  requested_format text not null check (requested_format in ('portrait', 'square', 'landscape')),
  file_type text not null check (file_type in ('png', 'jpeg', 'pdf')),
  watermarked boolean not null default false,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  output_storage_path text,
  error_code text check (error_code is null or char_length(error_code) <= 80),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index export_jobs_user_idx on public.export_jobs (user_id, created_at desc);
create index export_jobs_status_idx on public.export_jobs (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Administration and support
-- ---------------------------------------------------------------------------
create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 80),
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id text,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 200),
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 1 and 4000),
  order_reference text check (order_reference is null or char_length(order_reference) <= 64),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_status_idx on public.support_requests (status, created_at desc);
create trigger support_requests_updated_at before update on public.support_requests
  for each row execute function public.set_updated_at();

-- Fixed-window rate limiting shared by all server instances.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Automatic profile creation and template usage counting
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.increment_template_use_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.templates set use_count = use_count + 1 where id = new.template_id;
  return new;
end;
$$;

create trigger projects_count_template_use
  after insert on public.projects
  for each row execute function public.increment_template_use_count();
