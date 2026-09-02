# Secure beta waitlist edge

This Cloudflare Worker is the only public write endpoint for the beta site. It keeps n8n private on `127.0.0.1`, validates Cloudflare Turnstile server-side, limits submissions per network, deduplicates by an HMAC of the normalized email address, and encrypts identifying fields with AES-256-GCM before D1 storage.

## Cloudflare resources

1. Create a Turnstile widget for `asherun.github.io` and copy its site key and secret key.
2. Copy `wrangler.jsonc.example` to the ignored local file `wrangler.jsonc`.
3. Create the D1 database and place its ID in `wrangler.jsonc`:

   ```bash
   npx wrangler d1 create ladder-beta-waitlist
   npx wrangler d1 migrations apply ladder-beta-waitlist --remote
   ```

4. Generate and add four Worker secrets. Never commit their values:

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put DATA_ENCRYPTION_KEY
   npx wrangler secret put EMAIL_HASH_SECRET
   npx wrangler secret put SYNC_API_TOKEN
   ```

   `DATA_ENCRYPTION_KEY` must be a base64-encoded 32-byte key (`openssl rand -base64 32`). Use independent random values for `EMAIL_HASH_SECRET` and `SYNC_API_TOKEN` (`openssl rand -hex 32`).

5. Deploy with `npx wrangler deploy` and record the HTTPS Worker origin.

## GitHub Pages configuration

Set these repository variables under `Settings > Secrets and variables > Actions > Variables`:

- `LADDER_WAITLIST_API_URL`: `https://<worker-host>/v1/beta-signups`
- `LADDER_TURNSTILE_SITE_KEY`: the public production Turnstile site key

The site build rejects missing values and known Turnstile test keys. The Turnstile secret is stored only as a Worker secret.

## Local operations connection

Run `scripts/configure-waitlist-secrets.sh` from the private local automation stack. Enter the Worker URL and the same `SYNC_API_TOKEN`. The script stores them and a separate local AES key in macOS Keychain. Then run `scripts/sync-waitlist.py`; after verification, install the 15-minute LaunchAgent with `scripts/install-waitlist-sync-launch-agent.sh`.

Admin endpoints do not return CORS headers and require the bearer token. Public requests are accepted only from the configured origin. D1 records that have been synchronized are removed from the edge after 30 days; unsynchronized records expire after 12 months.

## Tests

```bash
node --test test/*.test.mjs
```

The tests cover valid encrypted storage, duplicate registration, origin enforcement, honeypot handling, failed CAPTCHA, rate limiting, admin authorization, sync acknowledgement, and invalid allowlist values. Cloudflare's published Turnstile test keys may be used only in a non-production site build with `LADDER_ALLOW_TURNSTILE_TEST_KEY=1`.
