# AUTIONAL_CHANGES — what the onboarding changed in this fork

> Companion to `AUTIONAL_SETUP.md`. Full problem log: `AI-ONBOARDING-NOTES.md`.
> Date: 2026-10-15 · Branch: `feature/autional` · Upstream base: `839a24df`
> Deployment: Vercel project `nextchat-demo` → https://nextchat-demo-eight.vercel.app (`.cn` region;
> CLI direct upload — `npx vercel deploy --prod --yes --archive=tgz`).

## Created

| Path                              | Purpose                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `app/autional/config.ts`          | SDK config constants (appId / issuer / tenant slug / authorize pin / logout paths / same-origin `/bff` resolver / portal URL); adaptations #1/#2 |
| `app/autional/logout.ts`          | RP-Initiated Logout builder — standard endpoint when an id-token hint exists, auth-host confirm page otherwise (the SDK persists `idToken: null`, so no hint ever exists); platform-defect workaround, notes C4N/E2N |
| `app/autional/server-auth.ts`     | Per-request Bearer verification via `/bff/identity/api/v1/auth/me` (revocation-aware) + 60s micro-cache / 10s negative cache; notes S1N |
| `app/autional/session-cookie.ts`  | `autional_token` cookie write/clear (SameSite=Lax, Secure on https); adaptation #3, novel C9 family |
| `app/autional/state-store.ts`     | Per-user state snapshot: private Blob (`state/<userId>.json`, overwrite, no random suffix) + fs fallback under `.data/`; userId regex guard; 4MB cap; notes S4N |
| `app/api/user-state/route.ts`     | `GET`/`PUT` state snapshot — session gate first, per-user key, 413 over-cap |
| `middleware.ts`                   | Local cookie-presence gate (`/` → `/login`) — the SDK middleware bundle breaks the react-server compile; notes C3N |
| `app/login/page.tsx`              | Login page — SSO button (authorize pinned), open-redirect-guarded `callbackUrl`, one-shot SSO auto-replay when a session-cookie trace exists; notes C5N |
| `app/oauth/callback/page.tsx`     | SSO callback — `handleOAuthCallback` → cookie write → guarded redirect; StrictMode-safe |
| `app/components/autional-providers.tsx` | `AutionalProvider` wrapper (same-origin `/bff` apiUrl) |
| `app/components/session-cookie-sync.tsx` | Bridges provider auth events → cookie (READY / USER_CHANGED / TOKEN_CHANGED → set; LOGGED_OUT → clear); adaptation #3 |
| `app/components/platform-sync.tsx` | Client sync orchestration — pull on login, 1500ms debounced push, `visibilitychange` flush, logout flush; in-flight serialization; stale-cookie reload guard; adaptations #7, notes C6N/D12N |
| `test/autional-*.test.ts` ×5      | Unit suites — config / logout URL / middleware / server-auth / state-store (28 tests) |
| `.vercelignore`                   | Keeps `.env*`, `.data/`, `.next/`, `.swc/` out of CLI uploads |
| `AUTIONAL_SETUP.md` · `AUTIONAL_CHANGES.md` · `AI-ONBOARDING-NOTES.md` | this wrap-up |

## Modified

| Path                              | Change                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `next.config.mjs`                 | rewrites `/bff/*` + `/.well-known/*` → `api.autional.cn` (same-origin proxy, adaptation #1) · `serverComponentsExternalPackages: ["@vercel/blob"]`; notes D2N |
| `app/layout.tsx`                  | wrap app in `<AutionalProviders>` + `<SessionCookieSync />` + `<PlatformSync />` |
| `app/api/auth.ts`                 | `auth()` async; Autional session gate upstream of the access-code overlay |
| `app/api/{302ai,alibaba,anthropic,azure,baidu,bytedance,deepseek,glm,google,iflytek,moonshot,openai,siliconflow,stability,xai}.ts` · `app/api/tencent/route.ts` | `auth(req, …)` → `await auth(req, …)` (16 provider routes) |
| `app/api/proxy.ts` · `app/api/webdav/[...path]/route.ts` · `app/api/upstash/[action]/[...key]/route.ts` · `app/api/artifacts/route.ts` | `await requireSession(req)` (OPTIONS passthrough first) |
| `app/components/settings.tsx`     | Account section: portal link (`getPortalUrl`) + logout (`performLogout`) |
| `app/locales/cn.ts` · `app/locales/en.ts` | `Settings.Account.*` strings |
| `app/store/access.ts`             | `fetch()` defaultModel branch now also updates the live config store (persist hydration detaches the reference); notes D7N |
| `app/store/config.ts`             | `DEFAULT_CONFIG.modelConfig.model` `gpt-4o-mini` → `gpt-5`; notes D5N/D7N |
| `package.json` · `yarn.lock`      | `@autional/api-identity 0.3.0 · core 0.3.4 · next 0.3.0 · react 0.3.0` · `@vercel/blob ^2.8.2` · `next ^14.1.1 → ^14.2.35` (known CVE fixes, incl. the middleware-bypass class; notes D1N) |
| `.env.template`                   | adds `NEXT_PUBLIC_AUTIONAL_{APP_ID,ISSUER,AUTHORIZE_URL,TENANT_SLUG}` + `DEFAULT_MODEL` |
| `.gitignore`                      | adds `.data/` (local fs fallback of the state store) |
| `README.md`                       | fork top section: Autional integration summary (changes table + env block + boundaries) |

## Deliberate deviations from the onboarding template

1. **Data model: single-user → multi-user with platform-persisted state** (user decision).
   Chat / Config / Mask / Prompt sync to the platform store; **Access (API keys) and Sync (cloud
   creds) never leave the device**.
2. Browser traffic goes same-origin (`/bff` rewrites) — the API's CORS allowlist rejects unlisted
   origins, same shape as experiments 1/2.
3. `authorizeUrl` pinned to the auth plane — in proxy form the SDK derives a same-origin authorize
   URL that lands on the API plane (no login UI) (adaptation #2).
4. Cookie bridging is app-side (adaptation #3): the SDK reads an `autional_token` cookie, but no
   SDK package ever writes one.
5. Server verification is app-side `/auth/me` per request (adaptation #5) — the cookie alone is
   never trusted.
6. The local middleware replaces the SDK's (notes C3N).
7. Logout with no hint navigates directly to the auth-host confirm page (notes C4N/E2N; removable
   once the platform fixes the standard endpoint's no-hint fallback).
8. No passwords in any tracked file (public fork); credentials only under `provision/` (gitignored).
9. `DEFAULT_MODEL` seeding in both the static seed and the live store (notes D7N) — the relay
   catalog has no `gpt-4o-mini`.
