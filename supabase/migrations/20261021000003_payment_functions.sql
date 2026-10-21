-- Celebrio — atomic, idempotent business operations.
--
-- These functions run as SECURITY DEFINER so they can update orders and
-- entitlements, which customers cannot write. Execution is revoked from
-- anon/authenticated: only server code using the service role may call the
-- payment functions. Admin helpers re-check is_admin() for the caller.

-- Records a provider webhook event. Returns true the first time an event id is
-- seen and false for duplicates, so handlers can skip repeated deliveries.
create or replace function public.record_webhook_event(p_provider text, p_event_id text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.payment_webhook_events (provider, event_id, event_type)
  values (p_provider, p_event_id, p_event_type)
  on conflict (provider, event_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

create or replace function public.finish_webhook_event(p_provider text, p_event_id text, p_outcome text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.payment_webhook_events
     set processed_at = now(), outcome = left(p_outcome, 120)
   where provider = p_provider and event_id = p_event_id;
$$;

-- Marks an order paid and grants exactly one entitlement.
-- Safe to call repeatedly (duplicate or out-of-order webhooks):
--   * an order that is already paid is returned unchanged;
--   * a refunded/disputed order is never re-opened;
--   * the amount and currency must match what the server originally charged.
create or replace function public.mark_order_paid(
  p_provider text,
  p_checkout_id text,
  p_payment_reference text,
  p_amount_minor integer,
  p_currency text,
  p_event_id text default null
)
returns table (order_id uuid, status text, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders
   where provider = p_provider and provider_checkout_id = p_checkout_id
   for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if o.status = 'paid' then
    return query select o.id, o.status, false;
    return;
  end if;

  if o.status in ('refunded', 'disputed') then
    return query select o.id, o.status, false;
    return;
  end if;

  if o.amount_minor <> p_amount_minor or o.currency <> upper(p_currency) then
    update public.orders set status = 'failed', failure_reason = 'amount_mismatch' where id = o.id;
    insert into public.order_events (order_id, from_status, to_status, source, provider_event_id, note)
    values (o.id, o.status, 'failed', 'webhook', p_event_id, 'Paid amount did not match the order amount');
    return query select o.id, 'failed'::text, true;
    return;
  end if;

  -- A late "paid" event after expiry/failure still means the customer paid,
  -- so it is honoured; the transition is recorded in order_events.
  update public.orders
     set status = 'paid',
         paid_at = now(),
         provider_payment_reference = coalesce(p_payment_reference, provider_payment_reference),
         failure_reason = null
   where id = o.id;

  insert into public.entitlements (user_id, order_id, project_id, allowed_formats)
  values (
    o.user_id,
    o.id,
    o.project_id,
    array(select jsonb_array_elements_text(o.entitlement_snapshot -> 'formats'))
  )
  on conflict on constraint entitlements_order_id_key do nothing;

  update public.projects p set status = 'purchased' where p.id = o.project_id and p.status = 'draft';

  insert into public.order_events (order_id, from_status, to_status, source, provider_event_id)
  values (o.id, o.status, 'paid', case when p_provider = 'free' then 'checkout' else 'webhook' end, p_event_id);

  return query select o.id, 'paid'::text, true;
end;
$$;

-- Moves a pending order to failed / expired / cancelled. Paid orders are untouched.
create or replace function public.mark_order_unsuccessful(
  p_provider text,
  p_checkout_id text,
  p_status text,
  p_reason text default null,
  p_event_id text default null
)
returns table (order_id uuid, status text, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
begin
  if p_status not in ('failed', 'expired', 'cancelled') then
    raise exception 'invalid_status';
  end if;
  select * into o from public.orders
   where provider = p_provider and provider_checkout_id = p_checkout_id
   for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if o.status <> 'pending' then
    return query select o.id, o.status, false;
    return;
  end if;
  update public.orders set status = p_status, failure_reason = left(p_reason, 300) where id = o.id;
  insert into public.order_events (order_id, from_status, to_status, source, provider_event_id, note)
  values (o.id, o.status, p_status, 'webhook', p_event_id, left(p_reason, 300));
  return query select o.id, p_status, true;
end;
$$;

-- Refunds (or flags a dispute on) a paid order and revokes its entitlement.
create or replace function public.mark_order_refunded(
  p_order_id uuid,
  p_status text,
  p_source text,
  p_actor uuid default null,
  p_event_id text default null,
  p_note text default null
)
returns table (order_id uuid, status text, changed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  o public.orders%rowtype;
begin
  if p_status not in ('refunded', 'disputed') then
    raise exception 'invalid_status';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if o.status = p_status then
    return query select o.id, o.status, false;
    return;
  end if;
  if o.status not in ('paid', 'disputed') then
    return query select o.id, o.status, false;
    return;
  end if;
  update public.orders
     set status = p_status,
         refunded_at = case when p_status = 'refunded' then now() else refunded_at end
   where id = o.id;
  update public.entitlements set status = 'revoked', revoked_at = now()
   where entitlements.order_id = o.id and entitlements.status = 'active';
  insert into public.order_events (order_id, from_status, to_status, source, actor_id, provider_event_id, note)
  values (o.id, o.status, p_status, p_source, p_actor, p_event_id, left(p_note, 300));
  return query select o.id, p_status, true;
end;
$$;

-- Fixed-window rate limiter. Returns true when the request is allowed.
create or replace function public.check_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c integer;
begin
  insert into public.rate_limits (key, window_start, count)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  -- Opportunistic cleanup of old windows.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return c <= p_max;
end;
$$;

-- Admin: save a validated template definition as a new version, atomically.
-- The server validates the JSON with the template schema before calling this.
create or replace function public.admin_save_template_definition(p_template_id uuid, p_definition jsonb, p_supported_formats text[], p_aspect_ratio text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_version integer;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.templates
     set template_definition = p_definition,
         supported_formats = p_supported_formats,
         aspect_ratio = p_aspect_ratio,
         version = version + 1
   where id = p_template_id
  returning version into new_version;
  if new_version is null then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;
  insert into public.template_versions (template_id, version, definition, created_by)
  values (p_template_id, new_version, p_definition, auth.uid());
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, safe_metadata)
  values (auth.uid(), 'template.definition_saved', 'template', p_template_id::text, jsonb_build_object('version', new_version));
  return new_version;
end;
$$;

-- Snapshot version 1 automatically whenever a template is created.
create or replace function public.snapshot_initial_template_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.template_versions (template_id, version, definition, created_by)
  values (new.id, new.version, new.template_definition, auth.uid())
  on conflict (template_id, version) do nothing;
  return new;
end;
$$;

create trigger templates_snapshot_version
  after insert on public.templates
  for each row execute function public.snapshot_initial_template_version();

-- Lock down execution rights.
revoke all on function public.record_webhook_event(text, text, text) from public, anon, authenticated;
revoke all on function public.finish_webhook_event(text, text, text) from public, anon, authenticated;
revoke all on function public.mark_order_paid(text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.mark_order_unsuccessful(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_order_refunded(uuid, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.increment_template_use_count() from public, anon, authenticated;
revoke all on function public.snapshot_initial_template_version() from public, anon, authenticated;
grant execute on function public.record_webhook_event(text, text, text) to service_role;
grant execute on function public.finish_webhook_event(text, text, text) to service_role;
grant execute on function public.mark_order_paid(text, text, text, integer, text, text) to service_role;
grant execute on function public.mark_order_unsuccessful(text, text, text, text, text) to service_role;
grant execute on function public.mark_order_refunded(uuid, text, text, uuid, text, text) to service_role;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
revoke all on function public.admin_save_template_definition(uuid, jsonb, text[], text) from public, anon;
grant execute on function public.admin_save_template_definition(uuid, jsonb, text[], text) to authenticated, service_role;
