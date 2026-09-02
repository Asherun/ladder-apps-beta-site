import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;

const { createHandler } = await import("../src/index.js");

class FakeStatement {
    constructor(db, sql) {
        this.db = db;
        this.sql = sql.replace(/\s+/gu, " ").trim();
        this.args = [];
    }

    bind(...args) {
        this.args = args;
        return this;
    }

    async first() {
        if (!this.sql.startsWith("INSERT INTO beta_signups")) throw new Error(`Unexpected first(): ${this.sql}`);
        const [id, emailHash, encryptedPayload, appsJson, platformsJson, locale, consentAt, createdAt, updatedAt] = this.args;
        let row = this.db.rows.find((candidate) => candidate.email_hash === emailHash);
        if (row) {
            Object.assign(row, {
                encrypted_payload: encryptedPayload,
                apps_json: appsJson,
                platforms_json: platformsJson,
                locale,
                consent_at: consentAt,
                updated_at: updatedAt,
                sync_version: row.sync_version + 1,
                status: row.status === "deleted" ? "pending" : row.status
            });
        } else {
            row = {
                id,
                email_hash: emailHash,
                encrypted_payload: encryptedPayload,
                apps_json: appsJson,
                platforms_json: platformsJson,
                locale,
                consent_at: consentAt,
                created_at: createdAt,
                updated_at: updatedAt,
                sync_version: 1,
                synced_version: 0,
                synced_at: null,
                status: "pending"
            };
            this.db.rows.push(row);
        }
        return { id: row.id, sync_version: row.sync_version };
    }

    async all() {
        if (!this.sql.startsWith("SELECT id, email_hash")) throw new Error(`Unexpected all(): ${this.sql}`);
        const limit = this.args[0];
        return {
            results: this.db.rows
                .filter((row) => row.sync_version > row.synced_version && row.status !== "deleted")
                .sort((left, right) => left.updated_at.localeCompare(right.updated_at))
                .slice(0, limit)
                .map((row) => ({ ...row }))
        };
    }

    async run() {
        if (this.sql.startsWith("UPDATE beta_signups")) {
            const [version, syncedAt, id, minimumVersion] = this.args;
            const row = this.db.rows.find((candidate) => candidate.id === id && candidate.sync_version >= minimumVersion);
            if (row) {
                row.synced_version = Math.max(row.synced_version, version);
                row.synced_at = syncedAt;
            }
            return { success: true };
        }
        if (this.sql.startsWith("DELETE FROM beta_signups")) return { success: true };
        throw new Error(`Unexpected run(): ${this.sql}`);
    }
}

class FakeDB {
    constructor() {
        this.rows = [];
    }

    prepare(sql) {
        return new FakeStatement(this, sql);
    }

    async batch(statements) {
        return Promise.all(statements.map((statement) => statement.run()));
    }
}

function testEnvironment({ limiterSuccess = true } = {}) {
    return {
        DB: new FakeDB(),
        WAITLIST_RATE_LIMITER: { limit: async () => ({ success: limiterSuccess }) },
        ALLOWED_ORIGINS: "https://asherun.github.io",
        TURNSTILE_ALLOWED_HOSTNAMES: "asherun.github.io",
        TURNSTILE_SECRET_KEY: "turnstile-secret",
        DATA_ENCRYPTION_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(17))),
        EMAIL_HASH_SECRET: "email-hash-secret-with-sufficient-entropy",
        SYNC_API_TOKEN: "sync-token-with-sufficient-entropy"
    };
}

function validPayload(overrides = {}) {
    return {
        firstName: "Asher",
        lastName: "Baranes",
        email: "asher@example.com",
        apps: ["flag-ladder", "math-ladder"],
        platforms: ["ios"],
        background: "parent",
        notes: "iPhone beta tester",
        locale: "he",
        adultConsent: true,
        captchaToken: "valid-token",
        website: "",
        ...overrides
    };
}

function publicRequest(payload = validPayload(), origin = "https://asherun.github.io") {
    return new Request("https://waitlist.example.workers.dev/v1/beta-signups", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            origin,
            "cf-connecting-ip": "203.0.113.10"
        },
        body: JSON.stringify(payload)
    });
}

function handlerWithCaptcha(result = { success: true, action: "beta_signup", hostname: "asherun.github.io" }) {
    return createHandler({
        siteverifyFetch: async () => new Response(JSON.stringify(result), {
            status: 200,
            headers: { "content-type": "application/json" }
        })
    });
}

test("stores a valid registration with encrypted PII", async () => {
    const env = testEnvironment();
    const result = await handlerWithCaptcha()(publicRequest(), env);
    assert.equal(result.status, 202);
    assert.equal(env.DB.rows.length, 1);
    const stored = env.DB.rows[0];
    assert.match(stored.encrypted_payload, /^v1\./u);
    assert.equal(stored.encrypted_payload.includes("Asher"), false);
    assert.equal(stored.encrypted_payload.includes("asher@example.com"), false);
    assert.deepEqual(JSON.parse(stored.apps_json), ["flag-ladder", "math-ladder"]);
});

test("deduplicates by an HMAC of the normalized email", async () => {
    const env = testEnvironment();
    const handle = handlerWithCaptcha();
    assert.equal((await handle(publicRequest(), env)).status, 202);
    assert.equal((await handle(publicRequest(validPayload({ notes: "Updated" })), env)).status, 202);
    assert.equal(env.DB.rows.length, 1);
    assert.equal(env.DB.rows[0].sync_version, 2);
});

test("rejects an unapproved browser origin", async () => {
    const env = testEnvironment();
    const result = await handlerWithCaptcha()(publicRequest(validPayload(), "https://attacker.example"), env);
    assert.equal(result.status, 403);
    assert.equal(env.DB.rows.length, 0);
});

test("silently accepts the honeypot without storing data", async () => {
    const env = testEnvironment();
    const result = await handlerWithCaptcha()(publicRequest(validPayload({ website: "spam.example" })), env);
    assert.equal(result.status, 202);
    assert.equal(env.DB.rows.length, 0);
});

test("rejects a failed Turnstile verification", async () => {
    const env = testEnvironment();
    const result = await handlerWithCaptcha({ success: false })(publicRequest(), env);
    assert.equal(result.status, 400);
    assert.equal(env.DB.rows.length, 0);
});

test("enforces the edge rate limit", async () => {
    const env = testEnvironment({ limiterSuccess: false });
    const result = await handlerWithCaptcha()(publicRequest(), env);
    assert.equal(result.status, 429);
    assert.equal(env.DB.rows.length, 0);
});

test("never exposes records without the admin bearer token", async () => {
    const env = testEnvironment();
    await handlerWithCaptcha()(publicRequest(), env);
    const request = new Request("https://waitlist.example.workers.dev/v1/admin/submissions");
    const result = await handlerWithCaptcha()(request, env);
    assert.equal(result.status, 401);
});

test("admin sync decrypts records and ACK removes them from the queue", async () => {
    const env = testEnvironment();
    const handle = handlerWithCaptcha();
    await handle(publicRequest(), env);

    const listRequest = new Request("https://waitlist.example.workers.dev/v1/admin/submissions", {
        headers: { authorization: `Bearer ${env.SYNC_API_TOKEN}` }
    });
    const listResult = await handle(listRequest, env);
    const listBody = await listResult.json();
    assert.equal(listResult.status, 200);
    assert.equal(listBody.submissions.length, 1);
    assert.equal(listBody.submissions[0].pii.email, "asher@example.com");

    const item = listBody.submissions[0];
    const ackRequest = new Request("https://waitlist.example.workers.dev/v1/admin/ack", {
        method: "POST",
        headers: {
            authorization: `Bearer ${env.SYNC_API_TOKEN}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ items: [{ id: item.id, version: item.version }] })
    });
    const ackResult = await handle(ackRequest, env);
    assert.equal(ackResult.status, 200);

    const emptyResult = await handle(listRequest, env);
    assert.deepEqual((await emptyResult.json()).submissions, []);
});

test("rejects malformed allowlist values before storage", async () => {
    const env = testEnvironment();
    const result = await handlerWithCaptcha()(publicRequest(validPayload({ apps: ["unknown-game"] })), env);
    assert.equal(result.status, 400);
    assert.equal(env.DB.rows.length, 0);
});
