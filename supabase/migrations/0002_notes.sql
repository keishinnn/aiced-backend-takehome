-- ===========================================================================
-- Notes feature — tenant-scoped via RLS.
--
-- A user may only read and create notes for groups they are a member of.
-- Enforcement is entirely in the RLS policies.
-- ===========================================================================

create table notes (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references groups(id) on delete cascade,
  author_id  uuid not null references users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert on notes to authenticated;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table notes enable row level security;

-- SELECT: a user can see notes only for groups they belong to.
create policy "members can view their group notes"
  on notes for select
  to authenticated
  using (
    exists (
      select 1 from memberships
      where memberships.user_id = auth.uid()
        and memberships.group_id = notes.group_id
    )
  );

-- INSERT: a user can create notes only for groups they belong to,
-- and the author_id must match the authenticated user.
create policy "members can insert notes into their groups"
  on notes for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from memberships
      where memberships.user_id = auth.uid()
        and memberships.group_id = notes.group_id
    )
  );
