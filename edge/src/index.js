const APP_IDS = new Set(["flag-ladder", "math-ladder", "english-ladder"]);
const PLATFORM_IDS = new Set(["ios", "tvos"]);
const BACKGROUNDS = new Set(["unspecified", "parent", "educator", "software", "other"]);
const LOCALES = new Set(["he", "en"]);
const MAX_BODY_BYTES = 12 * 1024;
const MAX_ADMIN_BATCH = 100;

class RequestError extends Error {
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64ToBytes(value) {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseCsv(value) {
    return new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function corsHeaders(origin, allowedOrigins) {
    if (!origin || !allowedOrigins.has(origin)) return {};
    return {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin"
    };
}

function response(body, status = 200, headers = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
            ...headers
        }
    });
}

function requireString(value, field, maxLength, { allowEmpty = false, multiline = false } = {}) {
    if (typeof value !== "string") throw new RequestError(400, `invalid_${field}`);
    const normalized = value.normalize("NFKC").trim();
    if (!allowEmpty && !normalized) throw new RequestError(400, `invalid_${field}`);
    if (normalized.length > maxLength) throw new RequestError(400, `invalid_${field}`);
    const prohibited = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u;
    if (prohibited.test(normalized)) throw new RequestError(400, `invalid_${field}`);
    return normalized;
}

function requireEnumArray(value, field, allowed, maxItems) {
    if (!Array.isArray(value) || value.length < 1 || value.length > maxItems) {
        throw new RequestError(400, `invalid_${field}`);
    }
    const normalized = [...new Set(value.map((item) => requireString(item, field, 40)))];
    if (normalized.length !== value.length || normalized.some((item) => !allowed.has(item))) {
        throw new RequestError(400, `invalid_${field}`);
    }
    return normalized.sort();
}

export function normalizeSubmission(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new RequestError(400, "invalid_payload");
    }

    const firstName = requireString(input.firstName, "first_name", 80);
    const lastName = requireString(input.lastName, "last_name", 80);
    const email = requireString(input.email, "email", 160).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new RequestError(400, "invalid_email");
    const notes = requireString(input.notes ?? "", "notes", 500, { allowEmpty: true, multiline: true });
    const background = requireString(input.background, "background", 40);
    const locale = requireString(input.locale, "locale", 5);
    const captchaToken = requireString(input.captchaToken, "captcha", 2048);
    const website = requireString(input.website ?? "", "website", 200, { allowEmpty: true });

    if (!BACKGROUNDS.has(background)) throw new RequestError(400, "invalid_background");
    if (!LOCALES.has(locale)) throw new RequestError(400, "invalid_locale");
    if (input.adultConsent !== true) throw new RequestError(400, "consent_required");

    return {
        firstName,
        lastName,
        email,
        apps: requireEnumArray(input.apps, "apps", APP_IDS, 3),
        platforms: requireEnumArray(input.platforms, "platforms", PLATFORM_IDS, 2),
        background,
        notes,
        locale,
        adultConsent: true,
        captchaToken,
        website
    };
}

async function importAesKey(encodedKey) {
    const raw = base64ToBytes(encodedKey);
    if (raw.byteLength !== 32) throw new Error("DATA_ENCRYPTION_KEY must contain exactly 32 bytes");
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPayload(payload, encodedKey) {
    const key = await importAesKey(encodedKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: encoder.encode("ladder-beta-waitlist:v1") },
        key,
        encoder.encode(JSON.stringify(payload))
    );
    return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptPayload(envelope, encodedKey) {
    const [version, encodedIv, encodedCiphertext] = String(envelope).split(".");
    if (version !== "v1" || !encodedIv || !encodedCiphertext) throw new Error("invalid_envelope");
    const key = await importAesKey(encodedKey);
    const plaintext = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: base64ToBytes(encodedIv),
            additionalData: encoder.encode("ladder-beta-waitlist:v1")
        },
        key,
        base64ToBytes(encodedCiphertext)
    );
    return JSON.parse(decoder.decode(plaintext));
}

async function hmacEmail(email, secret) {
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(email))));
}

async function sha256(value) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value))));
}

async function constantTimeEqual(left, right) {
    const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
    let difference = 0;
    for (let index = 0; index < leftHash.length; index += 1) {
        difference |= leftHash[index] ^ rightHash[index];
    }
    return difference === 0;
}

async function verifyTurnstile(submission, request, env, siteverifyFetch) {
    const remoteIp = request.headers.get("cf-connecting-ip") || "";
    const body = new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: submission.captchaToken,
        idempotency_key: crypto.randomUUID()
    });
    if (remoteIp) body.set("remoteip", remoteIp);

    const verification = await siteverifyFetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(8000)
    });
    if (!verification.ok) throw new RequestError(503, "security_check_unavailable");
    const result = await verification.json();
    const allowedHostnames = parseCsv(env.TURNSTILE_ALLOWED_HOSTNAMES);
    if (
        result.success !== true
        || result.action !== "beta_signup"
        || !allowedHostnames.has(String(result.hostname || ""))
    ) {
        throw new RequestError(400, "security_check_failed");
    }
}

async function checkRateLimit(request, env) {
    if (!env.WAITLIST_RATE_LIMITER?.limit) throw new Error("WAITLIST_RATE_LIMITER binding is required");
    const networkIdentifier = request.headers.get("cf-connecting-ip") || "unknown";
    const key = bytesToBase64Url(await sha256(networkIdentifier));
    const outcome = await env.WAITLIST_RATE_LIMITER.limit({ key });
    if (!outcome.success) throw new RequestError(429, "rate_limited");
}

function assertBindings(env) {
    for (const key of ["TURNSTILE_SECRET_KEY", "DATA_ENCRYPTION_KEY", "EMAIL_HASH_SECRET", "SYNC_API_TOKEN"]) {
        if (!env[key]) throw new Error(`${key} is required`);
    }
    if (String(env.EMAIL_HASH_SECRET).length < 32) throw new Error("EMAIL_HASH_SECRET is too short");
    if (String(env.SYNC_API_TOKEN).length < 32) throw new Error("SYNC_API_TOKEN is too short");
    if (parseCsv(env.ALLOWED_ORIGINS).size < 1) throw new Error("ALLOWED_ORIGINS is required");
    if (parseCsv(env.TURNSTILE_ALLOWED_HOSTNAMES).size < 1) throw new Error("TURNSTILE_ALLOWED_HOSTNAMES is required");
    if (!env.DB?.prepare) throw new Error("DB binding is required");
}

async function readJson(request) {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        throw new RequestError(415, "json_required");
    }
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_BODY_BYTES) throw new RequestError(413, "payload_too_large");
    const rawBody = await request.text();
    if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) throw new RequestError(413, "payload_too_large");
    try {
        return JSON.parse(rawBody);
    } catch {
        throw new RequestError(400, "invalid_json");
    }
}

async function storeSubmission(submission, env) {
    const now = new Date().toISOString();
    const emailHash = await hmacEmail(submission.email, env.EMAIL_HASH_SECRET);
    const encryptedPayload = await encryptPayload({
        firstName: submission.firstName,
        lastName: submission.lastName,
        email: submission.email,
        background: submission.background,
        notes: submission.notes
    }, env.DATA_ENCRYPTION_KEY);

    return env.DB.prepare(`
        INSERT INTO beta_signups (
            id, email_hash, encrypted_payload, apps_json, platforms_json,
            locale, consent_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email_hash) DO UPDATE SET
            encrypted_payload = excluded.encrypted_payload,
            apps_json = excluded.apps_json,
            platforms_json = excluded.platforms_json,
            locale = excluded.locale,
            consent_at = excluded.consent_at,
            updated_at = excluded.updated_at,
            sync_version = beta_signups.sync_version + 1,
            status = CASE WHEN beta_signups.status = 'deleted' THEN 'pending' ELSE beta_signups.status END
        RETURNING id, sync_version
    `).bind(
        crypto.randomUUID(),
        emailHash,
        encryptedPayload,
        JSON.stringify(submission.apps),
        JSON.stringify(submission.platforms),
        submission.locale,
        now,
        now,
        now
    ).first();
}

async function isAdminAuthorized(request, env) {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) return false;
    return constantTimeEqual(authorization.slice(7), env.SYNC_API_TOKEN);
}

async function handleAdminList(request, env) {
    if (!(await isAdminAuthorized(request, env))) return response({ ok: false }, 401);
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") || 100);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), MAX_ADMIN_BATCH) : 100;
    const result = await env.DB.prepare(`
        SELECT id, email_hash, encrypted_payload, apps_json, platforms_json,
               locale, consent_at, created_at, updated_at, sync_version
        FROM beta_signups
        WHERE sync_version > synced_version AND status <> 'deleted'
        ORDER BY updated_at ASC
        LIMIT ?
    `).bind(limit).all();

    const submissions = [];
    for (const row of result.results || []) {
        submissions.push({
            id: row.id,
            emailHash: row.email_hash,
            pii: await decryptPayload(row.encrypted_payload, env.DATA_ENCRYPTION_KEY),
            apps: JSON.parse(row.apps_json),
            platforms: JSON.parse(row.platforms_json),
            locale: row.locale,
            consentAt: row.consent_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            version: row.sync_version
        });
    }
    return response({ ok: true, submissions });
}

async function handleAdminAck(request, env) {
    if (!(await isAdminAuthorized(request, env))) return response({ ok: false }, 401);
    const body = await readJson(request);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ADMIN_BATCH) {
        throw new RequestError(400, "invalid_ack_batch");
    }
    const items = body.items.map((item) => {
        const id = requireString(item?.id, "id", 40);
        const version = Number(item?.version);
        if (!/^[0-9a-f-]{36}$/iu.test(id) || !Number.isInteger(version) || version < 1) {
            throw new RequestError(400, "invalid_ack_item");
        }
        return { id, version };
    });
    const now = new Date().toISOString();
    const statements = items.map(({ id, version }) => env.DB.prepare(`
        UPDATE beta_signups
        SET synced_version = MAX(synced_version, ?), synced_at = ?, updated_at = updated_at
        WHERE id = ? AND sync_version >= ?
    `).bind(version, now, id, version));
    await env.DB.batch(statements);
    return response({ ok: true, acknowledged: items.length });
}

async function handlePublicSubmission(request, env, siteverifyFetch) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigins = parseCsv(env.ALLOWED_ORIGINS);
    const cors = corsHeaders(origin, allowedOrigins);
    if (!allowedOrigins.has(origin)) return response({ ok: false }, 403);
    await checkRateLimit(request, env);
    const submission = normalizeSubmission(await readJson(request));

    if (submission.website) {
        return response({ ok: true, status: "received" }, 202, cors);
    }

    await verifyTurnstile(submission, request, env, siteverifyFetch);
    await storeSubmission(submission, env);
    return response({ ok: true, status: "received" }, 202, cors);
}

export function createHandler({ siteverifyFetch = fetch } = {}) {
    return async function handle(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get("origin") || "";
        const allowedOrigins = parseCsv(env.ALLOWED_ORIGINS);

        if (request.method === "OPTIONS" && url.pathname === "/v1/beta-signups") {
            if (!allowedOrigins.has(origin)) return response({ ok: false }, 403);
            return new Response(null, { status: 204, headers: corsHeaders(origin, allowedOrigins) });
        }

        try {
            assertBindings(env);
            if (request.method === "POST" && url.pathname === "/v1/beta-signups") {
                return await handlePublicSubmission(request, env, siteverifyFetch);
            }
            if (request.method === "GET" && url.pathname === "/v1/admin/submissions") {
                return await handleAdminList(request, env);
            }
            if (request.method === "POST" && url.pathname === "/v1/admin/ack") {
                return await handleAdminAck(request, env);
            }
            return response({ ok: false }, 404);
        } catch (error) {
            const status = error instanceof RequestError ? error.status : 500;
            const headers = url.pathname === "/v1/beta-signups"
                ? corsHeaders(origin, allowedOrigins)
                : {};
            return response({ ok: false, code: status < 500 ? error.code : "server_error" }, status, headers);
        }
    };
}

const handle = createHandler();

export default {
    fetch: handle,
    async scheduled(_event, env, context) {
        context.waitUntil(env.DB.prepare(`
            DELETE FROM beta_signups
            WHERE (synced_at IS NOT NULL AND synced_at < datetime('now', '-30 days'))
               OR created_at < datetime('now', '-365 days')
               OR status = 'deleted'
        `).run());
    }
};
