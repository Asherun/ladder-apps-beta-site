CREATE TABLE IF NOT EXISTS beta_signups (
    id TEXT PRIMARY KEY,
    email_hash TEXT NOT NULL UNIQUE,
    encrypted_payload TEXT NOT NULL,
    apps_json TEXT NOT NULL,
    platforms_json TEXT NOT NULL,
    locale TEXT NOT NULL,
    consent_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sync_version INTEGER NOT NULL DEFAULT 1,
    synced_version INTEGER NOT NULL DEFAULT 0,
    synced_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    CHECK (locale IN ('he', 'en')),
    CHECK (status IN ('pending', 'synced', 'deleted')),
    CHECK (sync_version >= 1),
    CHECK (synced_version >= 0)
);

CREATE INDEX IF NOT EXISTS idx_beta_signups_sync_queue
    ON beta_signups(status, synced_version, sync_version, updated_at);

CREATE INDEX IF NOT EXISTS idx_beta_signups_retention
    ON beta_signups(synced_at, created_at);
