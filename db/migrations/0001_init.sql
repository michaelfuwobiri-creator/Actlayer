-- ActLayer core schema. One row per scan; findings stored as jsonb since
-- the check set will keep changing as the AI Act's own phases roll out
-- (Aug 2026 transparency rules now, Dec 2026 marking deadline, etc.) --
-- a rigid column-per-check schema would need a migration every time a
-- check is added or reworded.
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  url          text not null,
  created_at   timestamptz not null default now(),
  score        int not null,              -- 0-100, see lib/checks.ts scoring
  findings     jsonb not null,            -- CheckResult[] from lib/checks.ts
  unlocked     boolean not null default false,
  stripe_session_id text
);

create index if not exists reports_created_at_idx on reports (created_at desc);
