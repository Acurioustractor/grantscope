CREATE TABLE charity_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  abn TEXT NOT NULL REFERENCES acnc_charities(abn),
  status TEXT NOT NULL DEFAULT 'pending',
  verification_method TEXT,
  profile_description TEXT,
  profile_story TEXT,
  contact_email TEXT,
  contact_name TEXT,
  featured BOOLEAN DEFAULT FALSE,
  feature_narrative TEXT,
  featured_at TIMESTAMPTZ,
  admin_notes TEXT,
  verified_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, abn)
);

-- RLS: users see own + verified claims
ALTER TABLE charity_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select own or verified" ON charity_claims FOR SELECT
  USING (auth.uid() = user_id OR status = 'verified');
CREATE POLICY "insert own" ON charity_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own" ON charity_claims FOR UPDATE USING (auth.uid() = user_id);
