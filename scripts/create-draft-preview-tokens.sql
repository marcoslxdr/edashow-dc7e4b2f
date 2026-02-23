-- Create draft_preview_tokens table for sharing draft posts for review
CREATE TABLE draft_preview_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_name VARCHAR(255),
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_preview_tokens_token ON draft_preview_tokens(token);
CREATE INDEX idx_preview_tokens_post_id ON draft_preview_tokens(post_id);

ALTER TABLE draft_preview_tokens ENABLE ROW LEVEL SECURITY;
-- No public policies - access only via admin client (service role)
