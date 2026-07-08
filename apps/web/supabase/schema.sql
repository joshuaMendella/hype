-- ============================================================
-- HYPE — Database Schema
-- Run this in: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Profiles (extends auth.users, auto-created on signup)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT,
  display_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Vault notes (each note = one graph node)
CREATE TABLE IF NOT EXISTS public.vault_notes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  path        TEXT NOT NULL,        -- e.g. "Style/preferences.md"
  title       TEXT NOT NULL,
  topic       TEXT,                 -- Work | Style | Food | Fitness | People | Goals | Insights | Profile
  content_md  TEXT DEFAULT '',
  confidence  FLOAT DEFAULT 0.8,   -- 0–1: how certain the AI is about this info
  source      TEXT DEFAULT 'conversation', -- conversation | inferred | user-confirmed | system
  entity_type TEXT,                        -- "item" | "brand" | "place" | "person" | "event" | null (system nodes)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, path)
);

-- Vault links (edges between notes in the graph)
CREATE TABLE IF NOT EXISTS public.vault_links (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_note_id   UUID REFERENCES public.vault_notes(id) ON DELETE CASCADE NOT NULL,
  target_note_id   UUID REFERENCES public.vault_notes(id) ON DELETE CASCADE NOT NULL,
  anchor_text      TEXT,
  link_type        TEXT DEFAULT 'brand',   -- "brand" | "tag"
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_note_id, target_note_id)
);

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Messages within conversations
CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Audit trail: which notes were created from which conversation
CREATE TABLE IF NOT EXISTS public.extractions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  note_id           UUID REFERENCES public.vault_notes(id) ON DELETE CASCADE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can only access their own data — enforced at DB level
-- ============================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_notes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extractions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own"       ON public.profiles     FOR ALL USING (auth.uid() = id);
CREATE POLICY "vault_notes: own"    ON public.vault_notes  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "vault_links: own"    ON public.vault_links  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "conversations: own"  ON public.conversations FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "messages: own conversations" ON public.messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM public.conversations WHERE user_id = auth.uid()
  ));

CREATE POLICY "extractions: own conversations" ON public.extractions FOR ALL
  USING (conversation_id IN (
    SELECT id FROM public.conversations WHERE user_id = auth.uid()
  ));

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create the root "_profile.md" note (center node of the graph) on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_vault()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vault_notes (user_id, path, title, topic, content_md, source)
  VALUES (
    NEW.id,
    '_profile.md',
    'You',
    'Profile',
    E'---\ntitle: You\ntopic: Profile\n---\n\nYour personal knowledge graph starts here.',
    'system'
  )
  ON CONFLICT (user_id, path) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_vault();

-- ============================================================
-- INDEXES (for graph query performance)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vault_notes_user    ON public.vault_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_links_user    ON public.vault_links(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_links_source  ON public.vault_links(source_note_id);
CREATE INDEX IF NOT EXISTS idx_vault_links_target  ON public.vault_links(target_note_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv       ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user  ON public.conversations(user_id);

-- ============================================================
-- MIGRATIONS (run these in Supabase SQL editor on existing DBs)
-- ============================================================

ALTER TABLE public.vault_notes ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.vault_links ADD COLUMN IF NOT EXISTS link_type TEXT DEFAULT 'brand';

-- Intent flag + scheduled event date (queried every chat turn for the today-events opener).
-- These exist in the live DB but were missing here — a fresh setup would break without them.
ALTER TABLE public.vault_notes ADD COLUMN IF NOT EXISTS intent BOOLEAN DEFAULT false;
ALTER TABLE public.vault_notes ADD COLUMN IF NOT EXISTS scheduled_for DATE;
CREATE INDEX IF NOT EXISTS idx_vault_notes_scheduled
  ON public.vault_notes(user_id, scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Phase 4 — advertiser data layer
-- DEPRECATED (2026-07-05, unused — see BUSINESS.md principle 2): consent is per-moment in chat,
-- never a stored per-category toggle. Nothing reads/writes this column; drop in a future migration.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ad_preferences JSONB DEFAULT '{}'::jsonb;
-- Ground-layer demographics for ad targeting: { "age": 28, "home_location": "Rzeszow" }.
-- Occupation lives as an `org` vault_note, not here. Filled gradually via lull nudges.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Intent lifecycle: expressed wants ("I need new running shoes") become tracked,
-- consent-gated, expiring referral opportunities. CPA/affiliate revenue lives here.
CREATE TABLE IF NOT EXISTS public.intents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entity_note_id  UUID REFERENCES public.vault_notes(id) ON DELETE CASCADE,
  category        TEXT,                       -- affiliate category (lib/ads/categories.ts)
  utterance       TEXT,                       -- phrase that signalled the intent
  confidence      FLOAT DEFAULT 0,
  status          TEXT DEFAULT 'open' CHECK (status IN ('open','offered','converted','expired')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intents: own" ON public.intents FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_intents_user ON public.intents(user_id);
CREATE INDEX IF NOT EXISTS idx_intents_open ON public.intents(user_id, status) WHERE status = 'open';

-- Auto-update conversations.updated_at on any row change (needed for session timeout detection)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Scout Digest v1 (2026-07-08) — city-level cache for free-tier event/tour lookups
-- (Ticketmaster/Bandsintown), so cost scales with distinct cities/day, not users.
-- NOT user-scoped: read/written only server-side via the admin client
-- (lib/scout/getScoutFind.ts). RLS is ENABLED with NO policies — a public-schema
-- table with RLS *off* would be exposed to the anon role via PostgREST; enabling
-- it with no policy locks out anon/authenticated while service_role (admin client)
-- bypasses RLS. This is the correct "server-only table" pattern for Supabase.
CREATE TABLE IF NOT EXISTS public.scout_cache (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key   TEXT NOT NULL,          -- e.g. "events:rzeszow:2026-07-08" or "artist:radiohead"
  payload     JSONB NOT NULL,         -- normalized find records (id,title,date,venue,url,source)
  fetched_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  UNIQUE(cache_key)
);
ALTER TABLE public.scout_cache ENABLE ROW LEVEL SECURITY;
-- No policies by design: only the service-role admin client (BYPASSRLS) may touch it.
