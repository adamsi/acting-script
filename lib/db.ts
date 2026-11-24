import postgres from 'postgres';

const SCHEMA = `
create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  author text not null default '',
  language text not null default 'he',
  original_file bytea,
  original_name text,
  original_mime text,
  my_character_id uuid,
  last_line_idx int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references scripts(id) on delete cascade,
  idx int not null default 0,
  name text not null,
  gender text not null default 'unknown',
  description text not null default '',
  voice_id text not null default ''
);
create table if not exists lines (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references scripts(id) on delete cascade,
  idx int not null,
  character_id uuid not null references characters(id) on delete cascade,
  text text not null,
  spoken_text text not null default '',
  audio bytea,
  audio_timings jsonb,
  audio_hash text
);
alter table scripts add column if not exists user_id text;
create index if not exists scripts_user_idx on scripts(user_id, updated_at desc);
create table if not exists usage_events (
  id bigint generated always as identity primary key,
  user_id text not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_idx on usage_events(user_id, kind, created_at);
create table if not exists worksheets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default '',
  author text not null default '',
  lines jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists worksheets_user_idx on worksheets(user_id, updated_at desc);
alter table lines add column if not exists audio_improved boolean not null default false;
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table lines add column if not exists audio_mime text;
alter table lines add column if not exists audio_source text;
alter table scripts add column if not exists recording_mode text not null default 'ai';
create index if not exists lines_script_idx on lines(script_id, idx);
create index if not exists characters_script_idx on characters(script_id, idx);
`;

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __sql?: Sql; __migrated?: Promise<unknown> };

/** Returns a connected client; creates the tables on first use. */
export async function db(): Promise<Sql> {
  if (!g.__sql) {
    const url = process.env.DB_URL;
    if (!url) throw new Error('DB_URL is not configured');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    g.__sql = postgres(url, {
      prepare: false, // required for Supabase transaction pooler
      max: 3,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: local ? false : 'require',
      onnotice: () => {},
    });
  }
  if (!g.__migrated) {
    g.__migrated = g.__sql.unsafe(SCHEMA).catch((e) => {
      g.__migrated = undefined;
      throw e;
    });
  }
  await g.__migrated;
  return g.__sql;
}
