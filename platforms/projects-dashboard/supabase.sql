-- =====================================================================
-- منصة متابعة مشاريع الوبران – فرع نجران | إعداد Supabase (ملف واحد)
-- انسخ هذا الملف كاملاً في: Supabase > SQL Editor > New query > Run
-- آمن لإعادة التشغيل.
-- =====================================================================

-- 1) المستخدمون والصلاحيات
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'pending' check (role in ('admin','viewer','pending')),
  created_at timestamptz not null default now()
);

-- 2) التقارير الأسبوعية (كل تقرير = ملف Excel كامل محفوظ بصيغة JSONB)
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  uploaded_at timestamptz not null default now(),
  file_name text,
  file_hash text,
  projects_data jsonb not null,
  collections_data jsonb,
  supporting_data jsonb,
  uploaded_by uuid references auth.users(id) default auth.uid()
);
create index if not exists weekly_reports_date_idx on public.weekly_reports (report_date desc, uploaded_at desc);
create index if not exists weekly_reports_hash_idx on public.weekly_reports (file_hash);

-- 3) دوال مساعدة للصلاحيات (security definer لتجنب تكرار RLS)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- 4) إنشاء ملف المستخدم تلقائياً عند التسجيل:
--    أول مستخدم يصبح Admin، وكل من بعده "pending" حتى يمنحه المدير صلاحية Viewer أو Admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email,
          case when exists (select 1 from public.profiles where role = 'admin') then 'pending' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ملفات للمستخدمين الموجودين مسبقاً (إن وُجدوا)
insert into public.profiles (id, email, role)
select u.id, u.email, 'pending' from auth.users u
on conflict (id) do nothing;
update public.profiles set role = 'admin'
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- 5) Row Level Security
alter table public.profiles enable row level security;
alter table public.weekly_reports enable row level security;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reports_read" on public.weekly_reports;
create policy "reports_read" on public.weekly_reports for select to authenticated
  using (public.my_role() in ('admin','viewer'));
drop policy if exists "reports_insert" on public.weekly_reports;
create policy "reports_insert" on public.weekly_reports for insert to authenticated
  with check (public.is_admin());
drop policy if exists "reports_delete" on public.weekly_reports;
create policy "reports_delete" on public.weekly_reports for delete to authenticated
  using (public.is_admin());

-- لا وصول للزوار غير المسجلين
revoke all on public.weekly_reports from anon;
revoke all on public.profiles from anon;
grant select, insert, delete on public.weekly_reports to authenticated;
grant select, update on public.profiles to authenticated;

-- (اختياري) ترقية مستخدم إلى Admin يدوياً:
-- update public.profiles set role = 'admin' where email = 'name@example.com';
