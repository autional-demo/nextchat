# Autional Integration — NextChat (fork)

## Basics

- Date: 2026-10-15
- Framework: Next.js 14.1.1 → **14.2.35** (App Router) + React 18 · Zustand stores · yarn
- Tenant: nextchat-demo (trial) — tenantId `01M4YNQ323YT61WW2AA9SM9AJ3`
- Region: **.cn** (all planes: issuer/api `api.autional.cn`, auth `auth.autional.cn`)
- Environment: local dev (`http://localhost:3000`) + Vercel production (`https://nextchat-demo-eight.vercel.app`)

## Configuration

- App ID: `client-TgTEqF0vse53` — registered public OAuth client
  (name `nextchat-local-mv8wvfmi`; `redirect_uris` = `http://localhost:3000/oauth/callback` +
  `https://nextchat-demo-eight.vercel.app/oauth/callback`; CORS origins both;
  `post_logout_redirect_uris` = both roots)
- Issuer: `https://api.autional.cn`
- API URL: `/bff` same-origin reverse proxy in the browser; absolute issuer URL server-side
- Authorize (SSO): pinned to `https://auth.autional.cn/oauth/api/v1/oauth/authorize`
  — in proxy form the SDK derives a same-origin authorize URL that lands on the API plane
  (no login UI); same pin as novel (adaptation #2 there)
- Tenant ID: `01M4YNQ323YT61WW2AA9SM9AJ3` — used by the hash transmission contract
- Admin: `nextchat+admin@autional.net`

## Security policy (tenant settings)

- Password transmission: **hash** — `sha256hex(password + "|" + tenantId)` (NIST baseline, same as experiments 1/2)
- Public trial registration (no invitation code), rate-limited per client_ip

## Test accounts

| Account        | Role      | Password                                          |
| -------------- | --------- | ------------------------------------------------- |
| nextchat-alice | test user | delivered separately — never written to this repo |
| nextchat-bob   | test user | delivered separately                              |
| nextchat-carol | test user | delivered separately                              |

> This fork is public: no password appears in any tracked file. Credentials live
> outside the repository, local machine only (`D:\ws\ai-onboarding-lab\provision\`).

## Portals

| Portal    | Address                                     | Purpose                                          |
| --------- | ------------------------------------------- | ------------------------------------------------ |
| Admin     | https://admin.autional.cn/nextchat-demo/    | users / roles / security policy / audit log      |
| User      | https://user.autional.cn/nextchat-demo/     | change password / devices / MFA                  |
| Security  | https://security.autional.cn/nextchat-demo/ | anomaly detection / login trends                 |
| Developer | https://developer.autional.cn               | API docs / OAuth clients / app settings (global) |
| Status    | https://status.autional.cn                  | service health (global)                          |

> Console portals are tenant-scoped — the `/nextchat-demo/` slug keeps users on the tenant.

## Integration adaptations (vs. the onboarding template)

1. **Same-origin `/bff` reverse proxy.** Browser traffic never crosses origins:
   `next.config.mjs` rewrites `/bff/:path*` and `/.well-known/:path*` → `api.autional.cn`.
   Browser-side `apiUrl` = `window.location.origin + "/bff"`; server-side = absolute issuer URL.
2. **`authorizeUrl` pinned to the auth plane** (`app/autional/config.ts`). Overridable via
   `NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL`.
3. **Session cookie bridge** (`app/components/session-cookie-sync.tsx`). `@autional/next` reads an
   `autional_token` cookie (middleware + provider seed) but no SDK package ever writes it
   (novel notes C9, same defect family). The bridge subscribes to provider auth events
   (READY / USER_CHANGED / TOKEN_CHANGED → set; LOGGED_OUT → clear).
4. **Local middleware** (`middleware.ts`). `@autional/next`'s middleware bundle breaks the
   react-server compile (dist loses `"use client"`; novel notes C7). Reimplemented locally as a
   cookie-presence gate redirecting `/` → `/login`; token authenticity is never trusted from
   the cookie (see #5).
5. **Server-side session gate** (`app/autional/server-auth.ts`). `verifyAccessToken` calls
   `/bff/identity/api/v1/auth/me` with the Bearer token (revocation-aware, edge-compatible
   fetch) with a 60s micro-cache + 10s negative cache. Applied:
   - LLM provider routes via `app/api/auth.ts` (gate added upstream of the access-code check;
     access code kept as an overlay) — 16 provider route files call the now-async `auth()`;
   - `proxy` / `webdav` / `upstash` / `artifacts` routes via `requireSession()`.
6. **Multi-user persistence** (`app/api/user-state/route.ts` + `app/autional/state-store.ts`).
   `state/<userId>.json` in a **private** Vercel Blob store (`access: "private"`,
   `allowOverwrite: true`); fs fallback under `.data/` when `BLOB_READ_WRITE_TOKEN` is absent
   (local dev). `userId` comes from `/auth/me` server-side only, regex-guarded
   (`^[A-Za-z0-9_-]{1,64}$`) against path injection. `MAX_STATE_BYTES` = 4MB (Vercel request
   body limit 4.5MB); over-limit PUTs get 413 and the client keeps data locally.
7. **Client sync orchestration** (`app/components/platform-sync.tsx`). On login: pull remote
   state once and merge; afterwards local change → 1500ms debounce push; `visibilitychange`
   flush; `registerBeforeLogout` final flush. Sync scope = Chat / Config / Mask / Prompt;
   **Access (API keys) and Sync (cloud creds) never leave the device**. Pushes serialize via an
   in-flight promise; the dirty flag is consumed before send and re-armed in `finally`.
8. **Logout** (`app/autional/logout.ts`). flush → build logout URL → clear local stores →
   SDK `logout()` → full-page navigation to the OP logout endpoint. With a hint, the standard
   endpoint is used (a fresh credentials login persists a real idToken — verified in the
   2026-10-15 production E2E: the OP session terminated, landing back on a clean `/login`).
   With no hint, the standard endpoint 302s to a dead host (`auth.autional.tianv.mobi`, 404),
   so we navigate directly to `auth.autional.cn/logout-confirm` instead (notes C4N/E2N;
   removable when the platform fixes the no-hint fallback).
9. **Default model seed.** Server `DEFAULT_MODEL` flows in via `useAccessStore.fetch()`; the fix
   additionally syncs the live (rehydrated) config store and seeds `gpt-5` in
   `app/store/config.ts` (notes D7N/D8N — the relay catalog has no `gpt-4o-mini`).

## Environment variables

`.env.template` additions: `NEXT_PUBLIC_AUTIONAL_APP_ID`, `NEXT_PUBLIC_AUTIONAL_ISSUER`,
`NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL`, `NEXT_PUBLIC_AUTIONAL_TENANT_SLUG`, `DEFAULT_MODEL`.

Vercel project env (pushed by `provision/nextchat-vercel-setup.mjs`, values never echoed):

| Key                                  | Type      | Source                         |
| ------------------------------------ | --------- | ------------------------------ |
| `OPENAI_API_KEY`                     | encrypted | local `.env` (relay key)       |
| `BASE_URL`                           | plain     | local `.env` (`api.tu-zi.com`) |
| `DEFAULT_MODEL`                      | plain     | `gpt-5` (relay catalog)        |
| `NEXT_PUBLIC_AUTIONAL_APP_ID`        | plain     | client id                      |
| `NEXT_PUBLIC_AUTIONAL_ISSUER`        | plain     | `https://api.autional.cn`      |
| `NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL` | plain     | auth-plane authorize URL       |
| `NEXT_PUBLIC_AUTIONAL_TENANT_SLUG`   | plain     | `nextchat-demo`                |
| `BLOB_READ_WRITE_TOKEN`              | injected  | auto (store connect)           |

## Commands

```bash
yarn dev                     # local dev → http://localhost:3000
node --no-warnings --experimental-vm-modules node_modules/jest/bin/jest.js --ci   # tests
yarn build                   # production build
node provision/nextchat-probe-isolation.mjs     # isolation probe (needs dev server)
node provision/nextchat-live-auth-probe.mjs     # .cn contract probe
ORIGIN=https://nextchat-demo-eight.vercel.app node provision/nextchat-update-client.mjs  # client refresh
```

## Deploying to Vercel

The upstream one-click deploy buttons (README) do not apply to this fork — it needs the
Autional environment variables and a pre-linked Vercel project. Deploy is a **CLI direct
upload** (the Vercel project is not Git-connected):

```bash
# run inside nextchat/ (token read from provision/, never committed, never echoed)
VERCEL_TOKEN="$(cat ../provision/vercel-token.txt)" \
VERCEL_ORG_ID=team_DH5R480Z49vsc8ZrHBVHiYY3 \
VERCEL_PROJECT_ID=prj_UtLy0EVSpRhxUZQEPiv3HeSwnBPy \
npx vercel deploy --prod --yes --archive=tgz
```

| Item               | Value                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel project     | `nextchat-demo` (`prj_UtLy0EVSpRhxUZQEPiv3HeSwnBPy`, team `team_DH5R480Z49vsc8ZrHBVHiYY3`)                                                                               |
| Blob store         | `store_QnigCBrtCrLy22tz` (iad1, **private**; static-token connect mode injects `BLOB_READ_WRITE_TOKEN`)                                                                  |
| Production URL     | **https://nextchat-demo-eight.vercel.app**                                                                                                                               |
| Production deploys | `a88qg4u8f` (first) → `12n2ywy20` (DEFAULT_MODEL fix) → `jy3ion23m` (push-race fix) → `7wk9zgi4o` (logout fix) → `a5azbokt0` (login card + README deploy notes, current) |
| Deploy mode        | CLI direct upload (`--archive=tgz`); `.vercelignore` excludes `.env*`, `.data/`, `.next/`, `.swc/`                                                                       |

## Verification record (2026-10-15)

- Unit: autional suites **5 suites / 28 tests PASS**; full suite **39 suites / 185 tests PASS**.
- Probes: `nextchat-probe-isolation.mjs` **6/6** (login / PUT / cross-user leak=false / read-back
  persistence / forged-token 401 / no-cookie 401); `nextchat-live-auth-probe.mjs` **4/4**.
- Local E2E: gate → SSO (brand → tenant → authorize → consent → callback) → token exchange via
  `/bff` → cookie bridge → gated LLM call → platform sync (4 keys/user) → rename → push →
  logout round-trip → account switch (bob clean) → alice restore from blob.
- Production E2E (final): login → message "生产正常" via gpt-5 → final PUT carries the complete
  reply → local wipe + reload recovers from the platform blob → logout round-trip (clean
  `/login`, OP session terminated, no zombie) → bob isolation (zero alice data; own data
  round-trips) → alice re-login (4 sessions intact).
- Production E2E — UI round (deploy `a5azbokt0`, clean state): login page card light + dark →
  credentials login (alice) → tenant form → consent → callback → 4 sessions restored from the
  platform blob → settings: promo card absent, Account section intact → gpt-5 reply “界面正常”
  (state PUTs 200) → logout via the standard endpoint (hint present) → clean `/login`, OP
  session terminated, autional cookies cleared. Mid-round the platform API plane had a ~6-min
  502 outage (nginx upstream; recovered; the consent title showed “未知应用” only during it).

## Known boundaries

- State snapshot cap 4MB (`MAX_STATE_BYTES`); over-limit uploads skipped, data stays local.
- Access store (API keys) is device-local by design; logout clears it.
- Cookie-bridged token expires with the 5-min access-token TTL; without a working SDK refresh
  chain (novel C12/C13), pushes stall with 401 until reload re-replays SSO (observed ~10min
  stalls; notes C5N/C6N).
- Desktop session-row delete is one-click (no confirm dialog, undo toast only) — upstream
  NextChat behavior; recovery via platform blob if a push already landed (notes D11N).
