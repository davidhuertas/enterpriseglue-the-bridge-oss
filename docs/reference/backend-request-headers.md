# EnterpriseGlue: mandatory request headers per backend endpoint

Snapshot of `davidhuertas/enterpriseglue-the-bridge-oss` at `main` (3d98390), generated 2026-10-21. It covers the same **446 endpoints** as the [frontend to backend endpoint inventory](frontend-backend-endpoints.md) and states, for each one, which headers and cookies the backend middleware requires before the handler runs. A CSV copy is in [backend-request-headers.csv](backend-request-headers.csv).

## The login headers, in short

The frontend sends `X-Tenant-Slug` and `X-XSRF-TOKEN` on almost every call, including login. Only one of them is enforced by the backend, and only in some cases:

- **`X-Tenant-Slug` is never read by the backend.** No backend or shared middleware reads it (`packages/frontend-host/src/utils/httpInterceptor.ts:212` is the only place it appears). The tenant comes from the URL path (`/t/:tenantSlug/...` or `/api/t/:tenantSlug/...`). In pooled mode it can also come from a verified tenant hostname or a signed placement header (`packages/shared/src/middleware/tenant.ts`). `resolveTenantContext` ignores unsigned tenant headers on purpose.
- **`X-XSRF-TOKEN` is not required for `POST /api/auth/login`.** That path is on the CSRF skip list (`packages/backend-host/src/app.ts:184`). `POST /api/t/:tenantSlug/auth/login` is *not* on the list, so it needs the header whenever the browser still holds an `accessToken` cookie, for example a stale session or a sign-in to a second tenant. With no `accessToken` cookie, CSRF is skipped for every route.

## Rules that apply to every endpoint

### 1. Authentication (`requireAuth` and related, `packages/shared/src/middleware/auth.ts`)

| Auth value in the table | What must be sent | Endpoints |
|---|---|---|
| **Session** | `Cookie: accessToken=<access JWT>` **or** `Authorization: Bearer <access JWT>`. Bearer wins if both are present. | 379 |
| **Session or API client** | As Session, or `Authorization: Bearer <api-client token>` (the API-client token prefix selects `requireApiClientAction`). | 25 |
| **Onboarding cookie** | `Cookie: onboardingToken=<JWT>` (`requireOnboarding`). | 8 |
| **Refresh cookie** | `Cookie: refreshToken=<JWT>` (or `refreshToken` in the JSON body). | 1 |
| **Public** | No credential. | 33 |

A missing or invalid credential returns `401`. In pooled mode the session JWT must also belong to the tenant in the path, or the request returns `403`.

### 2. CSRF: `X-XSRF-TOKEN` (`csrf-csrf` double-submit, `packages/backend-host/src/app.ts:172-209`)

The check runs on every `POST`, `PUT`, `PATCH` and `DELETE` (`GET`, `HEAD` and `OPTIONS` are ignored), unless one of these is true:

- the path is `/api/auth/login`, `/api/auth/refresh` or `/api/csrf-token`, or it matches `POST /api/(t/:slug/)auth/identity/callback`;
- the request carries `Authorization: Bearer …`;
- the request has no `accessToken` cookie.

When it runs, the request must carry both:

- the header `X-XSRF-TOKEN: <token>`, and
- exactly **one** `XSRF-TOKEN` cookie with the same token. If two cookies match, for example because of a cookie-domain mismatch, the request is rejected.

The token is HMAC-bound to the current `refreshToken` cookie, or `accessToken` or the client IP when that is missing, so a token issued before login stops working after login. Fresh tokens come from:

- the `X-XSRF-TOKEN` response header and `XSRF-TOKEN` cookie that every `GET`/`HEAD` response sets;
- `GET /api/csrf-token`;
- the rotation done by login, refresh, onboarding and SSO completion.

A failed check returns `403 {"error":"Invalid CSRF token"}`.

| X-XSRF-TOKEN value in the table | Meaning | Endpoints |
|---|---|---|
| **Yes** | Required for cookie-session callers. Not needed with `Authorization: Bearer`. | 237 |
| **Conditional** | Public or onboarding endpoint. Required only if the browser also sends an `accessToken` cookie. | 22 |
| **No (exempt)** | On the skip list. | 2 |
| **No** | Safe method (`GET`), never checked. | 185 |

### 3. Tenant selection (not a header)

| Tenant value in the table | Meaning |
|---|---|
| **`/t/:tenantSlug` prefix** | Tenant-scoped API. The frontend adds `/t/:tenantSlug` to the path. In single-tenant (non-pooled) mode the prefix is optional and only `default` is accepted. In pooled mode a path without the prefix works only on a verified tenant hostname, otherwise `404 Tenant`. |
| **In path** | The route itself contains `/api/t/:tenantSlug`. |
| **Optional `/t/:tenantSlug` prefix** | Plugin assets, served with or without the prefix. |
| **Pooled: host or signed placement** | Root login routes. In pooled mode `resolveTenantContext({ required: true })` needs a verified tenant hostname or an `X-EG-Tenant-Placement-*` signed assertion. The frontend uses the `/api/t/:tenantSlug/...` variant instead. |
| **From session** | Plugin operation gateway. The tenant is taken from the authenticated session. |
| **—** | Platform-level route, no tenant needed. |

The signed placement headers (`X-EG-Tenant-Placement`, `X-EG-Tenant-Placement-Signature`, `X-EG-Tenant-Placement-v2`, `X-EG-Tenant-Placement-v3`) are optional. They are only for control-plane or edge callers in pooled mode, and mixing versions returns `401`.

### 4. Content type

`express.json` parses a body only when `Content-Type` is `application/json` or `application/*+json`. Any endpoint that takes a JSON body therefore needs `Content-Type: application/json`, or the body arrives empty and validation fails with `400`. The one exception is `POST /api/authz/config-bundles/import-zip`, which needs `application/zip` or `application/octet-stream`.

### 5. Endpoint-specific headers

- `POST /api/auth/documentation/grant`: `Origin` must equal the configured frontend URL, or `403`. Browsers set it automatically.
- `POST /api/identity/provisioning-directories/:key/credentials` and `.../credentials/:credentialId/rotate`: `Idempotency-Key` is required when the caller authenticates with an API-client token, and optional for browser sessions.
- Optional headers the backend reads but never requires: `X-Request-Id` / `X-Correlation-Id` (propagated to engine calls and logs), `User-Agent` and `X-Forwarded-For` (audit records).

### Example: a cookie-session write call

```http
POST /t/acme/starbase-api/projects HTTP/1.1
Cookie: accessToken=…; refreshToken=…; XSRF-TOKEN=<token>
X-XSRF-TOKEN: <token>
Content-Type: application/json
```

The same call with `Authorization: Bearer <access JWT>` and no cookies needs neither `XSRF-TOKEN` nor `X-XSRF-TOKEN`.

## How this was built

For each inventory row, the Express route definition was read at its `file:line`. The middleware chain (and local helper arrays such as plugin `tenantRead`/`deploymentManage`), plus any router-level `router.use(requireAuth)` that covers the path (`platform-admin/routes/admin.ts`, `mission-control/*`), were classified as listed above. Dependency-injected wrappers (`requireConfigBundleAccess`, `requireIdentityProvisioningAccess`) and handler-level header checks were read by hand. The `csrf-csrf@4.0.3` defaults (`ignoredMethods = GET, HEAD, OPTIONS`) were checked against the published package. Endpoints the frontend never calls (SCIM, `/api/workloads/*`, `/api/platform/tenants/:id/releases/*` with `Idempotency-Key`, and so on) are out of scope, as in the inventory.

## Endpoints

"🔗" marks a full-page browser navigation, where the browser sends cookies by itself.

### `/_enterpriseglue` (1)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/_enterpriseglue/plugins/:pluginId/:version/*assetPath` | Public | No | Optional `/t/:tenantSlug` prefix | — | `plugins/pluginRuntime.ts:1850` |

### `/api/admin` (30)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/admin/branding` | Session | No | — | — | `modules/platform-admin/routes/branding.ts:51` |
| PUT | `/api/admin/branding` | Session | Yes | — | — | `modules/platform-admin/routes/branding.ts:65` |
| DELETE | `/api/admin/branding` | Session | Yes | — | — | `modules/platform-admin/routes/branding.ts:97` |
| GET | `/api/admin/email-configs` | Session | No | — | — | `modules/admin/routes/email-configs.ts:40` |
| POST | `/api/admin/email-configs` | Session | Yes | — | — | `modules/admin/routes/email-configs.ts:92` |
| PATCH | `/api/admin/email-configs/:id` | Session | Yes | — | — | `modules/admin/routes/email-configs.ts:157` |
| DELETE | `/api/admin/email-configs/:id` | Session | Yes | — | — | `modules/admin/routes/email-configs.ts:214` |
| POST | `/api/admin/email-configs/:id/set-default` | Session | Yes | — | — | `modules/admin/routes/email-configs.ts:248` |
| POST | `/api/admin/email-configs/:id/test` | Session | Yes | — | — | `modules/admin/routes/email-configs.ts:277` |
| GET | `/api/admin/email-platform-name` | Session | No | — | — | `modules/admin/routes/email-templates.ts:38` |
| PUT | `/api/admin/email-platform-name` | Session | Yes | — | — | `modules/admin/routes/email-templates.ts:51` |
| GET | `/api/admin/email-templates` | Session | No | — | — | `modules/admin/routes/email-templates.ts:81` |
| PATCH | `/api/admin/email-templates/:id` | Session | Yes | — | — | `modules/admin/routes/email-templates.ts:129` |
| POST | `/api/admin/email-templates/:id/preview` | Session | Yes | — | — | `modules/admin/routes/email-templates.ts:465` |
| POST | `/api/admin/email-templates/:id/reset` | Session | Yes | — | — | `modules/admin/routes/email-templates.ts:184` |
| GET | `/api/admin/engines` | Session | No | — | — | `modules/platform-admin/routes/governance.ts:137` |
| POST | `/api/admin/engines/:engineId/assign-delegate` | Session | Yes | — | — | `modules/platform-admin/routes/governance.ts:286` |
| POST | `/api/admin/engines/:engineId/assign-owner` | Session | Yes | — | — | `modules/platform-admin/routes/governance.ts:250` |
| GET | `/api/admin/environments` | Session | No | — | — | `modules/platform-admin/routes/environments.ts:31` |
| POST | `/api/admin/environments` | Session | Yes | — | — | `modules/platform-admin/routes/environments.ts:45` |
| PUT | `/api/admin/environments/:id` | Session | Yes | — | — | `modules/platform-admin/routes/environments.ts:76` |
| DELETE | `/api/admin/environments/:id` | Session | Yes | — | — | `modules/platform-admin/routes/environments.ts:109` |
| POST | `/api/admin/environments/reorder` | Session | Yes | — | — | `modules/platform-admin/routes/environments.ts:144` |
| GET | `/api/admin/projects` | Session | No | — | — | `modules/platform-admin/routes/governance.ts:100` |
| POST | `/api/admin/projects/:projectId/assign-delegate` | Session | Yes | — | — | `modules/platform-admin/routes/governance.ts:214` |
| POST | `/api/admin/projects/:projectId/assign-owner` | Session | Yes | — | — | `modules/platform-admin/routes/governance.ts:178` |
| GET | `/api/admin/settings` | Session | No | — | — | `modules/platform-admin/routes/settings.ts:33` |
| PUT | `/api/admin/settings` | Session | Yes | — | — | `modules/platform-admin/routes/settings.ts:47` |
| GET | `/api/admin/setup-status` | Session | No | — | — | `modules/admin/routes/setup-status.ts:23` |
| GET | `/api/admin/users/search` | Session | No | — | — | `modules/platform-admin/routes/governance.ts:66` |

### `/api/audit` (3)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/audit/actions` | Session | No | `/t/:tenantSlug` prefix | — | `modules/audit/routes/audit.ts:198` |
| GET | `/api/audit/logs` | Session | No | `/t/:tenantSlug` prefix | — | `modules/audit/routes/audit.ts:61` |
| GET | `/api/audit/stats` | Session | No | `/t/:tenantSlug` prefix | — | `modules/audit/routes/audit.ts:148` |

### `/api/auth` (37)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/auth/branding` | Public | No | — | — | `modules/auth/routes/me.ts:140` |
| POST | `/api/auth/change-password` | Session | Yes | — | — | `modules/auth/routes/password.ts:147` |
| POST | `/api/auth/cloud-passkey/complete` | Public | Conditional | — | — | `modules/auth/routes/cloud-email-passkey.ts:250` |
| POST | `/api/auth/cloud-passkey/options` | Public | Conditional | — | — | `modules/auth/routes/cloud-email-passkey.ts:233` |
| POST | `/api/auth/cloud-signup/email/passkey/complete` | Public | Conditional | — | — | `modules/auth/routes/cloud-email-passkey.ts:170` |
| POST | `/api/auth/cloud-signup/email/passkey/options` | Public | Conditional | — | — | `modules/auth/routes/cloud-email-passkey.ts:150` |
| POST | `/api/auth/cloud-signup/email/request` | Public | Conditional | — | — | `modules/auth/routes/cloud-email-passkey.ts:100` |
| GET | `/api/auth/cloud-signup/providers` | Public | No | — | — | `modules/auth/routes/identity-oidc.ts:408` |
| GET | `/api/auth/cloud-signup/providers/:providerId/start` 🔗 | Public | No | — | — | `modules/auth/routes/identity-oidc.ts:421` |
| POST | `/api/auth/complete-onboarding` | Onboarding cookie | Conditional | — | — | `modules/auth/routes/onboarding.ts:100` |
| GET | `/api/auth/documentation/configuration` | Public | No | — | — | `modules/auth/routes/documentation.ts:16` |
| POST | `/api/auth/documentation/grant` | Session | Yes | — | `Origin` = frontend URL | `modules/auth/routes/documentation.ts:19` |
| POST | `/api/auth/forgot-password` | Public | Conditional | — | — | `modules/auth/routes/forgot-password.ts:37` |
| POST | `/api/auth/login` | Public | No (exempt) | Pooled: host or signed placement | — | `modules/auth/routes/login.ts:343` |
| GET | `/api/auth/login-methods` | Public | No | Pooled: host or signed placement | — | `modules/auth/routes/identity-oidc.ts:558` |
| POST | `/api/auth/logout` | Session | Yes | — | — | `modules/auth/routes/logout.ts:57` |
| GET | `/api/auth/me` | Session | No | — | — | `modules/auth/routes/me.ts:35` |
| PATCH | `/api/auth/me` | Session | Yes | — | — | `modules/auth/routes/me.ts:82` |
| GET | `/api/auth/me/identity-providers` | Session | No | — | — | `modules/auth/routes/identity-oidc.ts:451` |
| GET | `/api/auth/me/identity-providers/:providerId/link` 🔗 | Session | No | — | — | `modules/auth/routes/identity-oidc.ts:482` |
| GET | `/api/auth/my-tenants` | Session | No | — | — | `modules/tenancy/routes/tenants.ts:438` |
| GET | `/api/auth/onboarding/login-methods` | Onboarding cookie | No | — | — | `modules/auth/routes/identity-oidc.ts:544` |
| POST | `/api/auth/onboarding/providers/:providerId/login` | Onboarding cookie | Conditional | — | — | `modules/auth/routes/identity-oidc.ts:546` |
| GET | `/api/auth/onboarding/providers/:providerId/start` 🔗 | Onboarding cookie | No | — | — | `modules/auth/routes/identity-oidc.ts:545` |
| GET | `/api/auth/platform-settings` | Session | No | — | — | `modules/auth/routes/me.ts:188` |
| POST | `/api/auth/providers/:providerId/login` | Public | Conditional | Pooled: host or signed placement | — | `modules/auth/routes/identity-oidc.ts:560` |
| GET | `/api/auth/providers/:providerId/start` 🔗 | Public | No | Pooled: host or signed placement | — | `modules/auth/routes/identity-oidc.ts:559` |
| POST | `/api/auth/recovery/login` | Public | Conditional | — | — | `modules/auth/routes/login.ts:351` |
| POST | `/api/auth/refresh` | Refresh cookie | No (exempt) | — | — | `modules/auth/routes/refresh.ts:41` |
| POST | `/api/auth/resend-verification` | Public | Conditional | — | — | `modules/auth/routes/verify-email.ts:81` |
| POST | `/api/auth/reset-password` | Session | Yes | — | — | `modules/auth/routes/password.ts:38` |
| POST | `/api/auth/reset-password-with-token` | Public | Conditional | — | — | `modules/auth/routes/forgot-password.ts:92` |
| POST | `/api/auth/switch-tenant` | Session | Yes | — | — | `modules/tenancy/routes/tenants.ts:443` |
| POST | `/api/auth/tenant-discovery` | Public | Conditional | — | — | `modules/tenancy/routes/tenants.ts:428` |
| POST | `/api/auth/tenant-discovery/exchange` | Public | Conditional | — | — | `modules/tenancy/routes/tenants.ts:432` |
| GET | `/api/auth/verify-email` | Public | No | — | — | `modules/auth/routes/verify-email.ts:20` |
| GET | `/api/auth/verify-reset-token` | Public | No | — | — | `modules/auth/routes/forgot-password.ts:158` |

### `/api/authz` (78)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/authz/api-clients` | Session | No | — | — | `modules/platform-admin/routes/authz/machines.ts:25` |
| POST | `/api/authz/api-clients` | Session | Yes | — | — | `modules/platform-admin/routes/authz/machines.ts:35` |
| DELETE | `/api/authz/api-clients/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/machines.ts:56` |
| POST | `/api/authz/api-clients/:id/rotate` | Session | Yes | — | — | `modules/platform-admin/routes/authz/machines.ts:46` |
| GET | `/api/authz/audit` | Session | No | — | — | `modules/platform-admin/routes/authz/audit.ts:38` |
| POST | `/api/authz/check` | Session | Yes | — | — | `modules/platform-admin/routes/authz.ts:120` |
| POST | `/api/authz/config-bundles/apply` | Session or API client | Yes | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:154` |
| POST | `/api/authz/config-bundles/diff` | Session or API client | Yes | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:143` |
| GET | `/api/authz/config-bundles/export` | Session or API client | No | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:326` |
| GET | `/api/authz/config-bundles/governance-ownership` | Session or API client | No | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:195` |
| POST | `/api/authz/config-bundles/governance-ownership/apply` | Session or API client | Yes | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:220` |
| POST | `/api/authz/config-bundles/governance-ownership/preview` | Session or API client | Yes | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:199` |
| GET | `/api/authz/config-bundles/governance-ownership/receipts` | Session or API client | No | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:247` |
| POST | `/api/authz/config-bundles/import-url` | Session or API client | Yes | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:100` |
| POST | `/api/authz/config-bundles/import-zip` | Session or API client | Yes | — | `Content-Type: application/zip` or `application/octet-stream` | `modules/platform-admin/routes/authz/config-bundles.ts:87` |
| POST | `/api/authz/config-bundles/preview` | Session or API client | Yes | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:113` |
| GET | `/api/authz/config-bundles/runs` | Session or API client | No | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:257` |
| GET | `/api/authz/config-bundles/runs/:id` | Session or API client | No | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:267` |
| GET | `/api/authz/config-bundles/runs/:id/identity-replay-tasks` | Session or API client | No | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:277` |
| GET | `/api/authz/config-bundles/runs/:id/runtime-reconciliation-tasks` | Session or API client | No | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:303` |
| POST | `/api/authz/config-bundles/validate-secret-refs` | Session or API client | Yes | — | — | `modules/platform-admin/routes/authz/config-bundles.ts:119` |
| GET | `/api/authz/engine-sets` | Session | No | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:36` |
| POST | `/api/authz/engine-sets` | Session | Yes | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:56` |
| GET | `/api/authz/engine-sets/:id` | Session | No | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:67` |
| PUT | `/api/authz/engine-sets/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:79` |
| DELETE | `/api/authz/engine-sets/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:90` |
| POST | `/api/authz/engine-sets/:id/materialize` | Session | Yes | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:101` |
| POST | `/api/authz/engine-sets/preview` | Session | Yes | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:46` |
| POST | `/api/authz/evaluate` | Session | Yes | — | — | `modules/platform-admin/routes/authz.ts:305` |
| GET | `/api/authz/external-engine-systems` | Session | No | — | — | `modules/platform-admin/routes/authz/external-engine-systems.ts:75` |
| POST | `/api/authz/external-engine-systems` | Session | Yes | — | — | `modules/platform-admin/routes/authz/external-engine-systems.ts:96` |
| PUT | `/api/authz/external-engine-systems/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/external-engine-systems.ts:124` |
| DELETE | `/api/authz/external-engine-systems/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/external-engine-systems.ts:161` |
| GET | `/api/authz/external-engines` | Session | No | — | — | `modules/platform-admin/routes/authz/external-engines.ts:38` |
| GET | `/api/authz/external-engines/:id/audit` | Session | No | — | — | `modules/platform-admin/routes/authz/external-engines.ts:115` |
| POST | `/api/authz/external-engines/:id/decommission` | Session | Yes | — | — | `modules/platform-admin/routes/authz/external-engines.ts:133` |
| POST | `/api/authz/external-engines/:id/reactivate` | Session | Yes | — | — | `modules/platform-admin/routes/authz/external-engines.ts:165` |
| POST | `/api/authz/external-engines/:id/reconcile` | Session | Yes | — | — | `modules/platform-admin/routes/authz/external-engines.ts:206` |
| GET | `/api/authz/group-memberships` | Session | No | — | — | `modules/platform-admin/routes/authz/assignments.ts:312` |
| POST | `/api/authz/group-memberships` | Session | Yes | — | — | `modules/platform-admin/routes/authz/assignments.ts:327` |
| DELETE | `/api/authz/group-memberships/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/assignments.ts:343` |
| GET | `/api/authz/groups` | Session | No | — | — | `modules/platform-admin/routes/authz/assignments.ts:252` |
| POST | `/api/authz/groups` | Session | Yes | — | — | `modules/platform-admin/routes/authz/assignments.ts:266` |
| PUT | `/api/authz/groups/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/assignments.ts:282` |
| DELETE | `/api/authz/groups/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/assignments.ts:297` |
| GET | `/api/authz/me/permissions` | Session | No | — | — | `modules/platform-admin/routes/authz.ts:198` |
| GET | `/api/authz/permissions` | Session | No | — | — | `modules/platform-admin/routes/authz/roles.ts:110` |
| POST | `/api/authz/permissions` | Session | Yes | — | — | `modules/platform-admin/routes/authz/roles.ts:114` |
| GET | `/api/authz/policies` | Session | No | — | — | `modules/platform-admin/routes/authz/policies.ts:18` |
| POST | `/api/authz/policies` | Session | Yes | — | — | `modules/platform-admin/routes/authz/policies.ts:28` |
| PUT | `/api/authz/policies/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/policies.ts:49` |
| DELETE | `/api/authz/policies/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/policies.ts:65` |
| GET | `/api/authz/project-engine-targets` | Session | No | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:42` |
| POST | `/api/authz/project-engine-targets` | Session | Yes | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:63` |
| GET | `/api/authz/project-engine-targets/:id` | Session | No | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:67` |
| PUT | `/api/authz/project-engine-targets/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:71` |
| DELETE | `/api/authz/project-engine-targets/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:75` |
| POST | `/api/authz/project-engine-targets/evaluate` | Session | Yes | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:47` |
| POST | `/api/authz/project-engine-targets/sync-legacy` | Session | Yes | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:59` |
| GET | `/api/authz/role-assignments` | Session | No | — | — | `modules/platform-admin/routes/authz/assignments.ts:189` |
| POST | `/api/authz/role-assignments` | Session | Yes | — | — | `modules/platform-admin/routes/authz/assignments.ts:214` |
| DELETE | `/api/authz/role-assignments/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/assignments.ts:240` |
| GET | `/api/authz/roles` | Session | No | — | — | `modules/platform-admin/routes/authz/roles.ts:129` |
| POST | `/api/authz/roles` | Session | Yes | — | — | `modules/platform-admin/routes/authz/roles.ts:168` |
| GET | `/api/authz/roles/:id` | Session | No | — | — | `modules/platform-admin/routes/authz/roles.ts:156` |
| PUT | `/api/authz/roles/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/roles.ts:183` |
| DELETE | `/api/authz/roles/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/roles.ts:198` |
| GET | `/api/authz/runtime-resource-sets` | Session | No | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:120` |
| POST | `/api/authz/runtime-resource-sets/:id/materialize` | Session | Yes | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:129` |
| GET | `/api/authz/runtime-resources` | Session | No | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:111` |
| POST | `/api/authz/runtime-resources/:id/reconcile` | Session | Yes | — | — | `modules/platform-admin/routes/authz/engine-sets.ts:133` |
| GET | `/api/authz/service-accounts` | Session | No | — | — | `modules/platform-admin/routes/authz/machines.ts:67` |
| POST | `/api/authz/service-accounts` | Session | Yes | — | — | `modules/platform-admin/routes/authz/machines.ts:77` |
| DELETE | `/api/authz/service-accounts/:id` | Session | Yes | — | — | `modules/platform-admin/routes/authz/machines.ts:103` |
| POST | `/api/authz/service-accounts/:id/rotate` | Session | Yes | — | — | `modules/platform-admin/routes/authz/machines.ts:93` |
| GET | `/api/authz/sso-sync-runs` | Session | No | — | — | `modules/platform-admin/routes/authz/sso-sync-diagnostics.ts:21` |
| GET | `/api/authz/sso-sync-runs/:id/events` | Session | No | — | — | `modules/platform-admin/routes/authz/sso-sync-diagnostics.ts:60` |
| POST | `/api/authz/sso-sync-runs/reconcile` | Session | Yes | — | — | `modules/platform-admin/routes/authz/sso-sync-diagnostics.ts:39` |

### `/api/dashboard` (2)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/dashboard/context` | Session | No | `/t/:tenantSlug` prefix | — | `modules/dashboard/routes/context.ts:53` |
| GET | `/api/dashboard/stats` | Session | No | `/t/:tenantSlug` prefix | — | `modules/dashboard/routes/stats.ts:19` |

### `/api/identity` (31)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/identity/mappings` | Session | No | — | — | `modules/platform-admin/routes/identity-mappings.ts:67` |
| POST | `/api/identity/mappings` | Session | Yes | — | — | `modules/platform-admin/routes/identity-mappings.ts:70` |
| PUT | `/api/identity/mappings/:id` | Session | Yes | — | — | `modules/platform-admin/routes/identity-mappings.ts:162` |
| DELETE | `/api/identity/mappings/:id` | Session | Yes | — | — | `modules/platform-admin/routes/identity-mappings.ts:168` |
| POST | `/api/identity/mappings/:id/access` | Session | Yes | — | — | `modules/platform-admin/routes/identity-mappings.ts:118` |
| POST | `/api/identity/mappings/provision-access` | Session | Yes | — | — | `modules/platform-admin/routes/identity-mappings.ts:75` |
| POST | `/api/identity/mappings/stored-snapshot-preview` | Session | Yes | — | — | `modules/platform-admin/routes/identity-mappings.ts:178` |
| POST | `/api/identity/mappings/test` | Session | Yes | — | — | `modules/platform-admin/routes/identity-mappings.ts:174` |
| POST | `/api/identity/provider-secrets` | Session | Yes | — | — | `modules/platform-admin/routes/identity-providers.ts:80` |
| POST | `/api/identity/provider-secrets/retire` | Session | Yes | — | — | `modules/platform-admin/routes/identity-providers.ts:100` |
| GET | `/api/identity/providers` | Session | No | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:76` |
| POST | `/api/identity/providers` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:244` |
| PUT | `/api/identity/providers/:key` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:252` |
| DELETE | `/api/identity/providers/:key` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:315` |
| POST | `/api/identity/providers/:key/external-identities/unlink` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:188` |
| POST | `/api/identity/providers/:key/reconcile` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:280` |
| POST | `/api/identity/providers/:key/reconciliation-preview` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:289` |
| POST | `/api/identity/providers/:key/replay-memberships` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:298` |
| PUT | `/api/identity/providers/:key/secrets/:purpose` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:120` |
| GET | `/api/identity/providers/:key/sync-runs` | Session | No | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:211` |
| POST | `/api/identity/providers/:key/test-connection` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/platform-admin/routes/identity-providers.ts:227` |
| GET | `/api/identity/provisioning-directories` | Session or API client | No | — | — | `modules/platform-admin/routes/identity-provisioning.ts:78` |
| POST | `/api/identity/provisioning-directories` | Session or API client | Yes | — | — | `modules/platform-admin/routes/identity-provisioning.ts:94` |
| PUT | `/api/identity/provisioning-directories/:key` | Session or API client | Yes | — | — | `modules/platform-admin/routes/identity-provisioning.ts:133` |
| DELETE | `/api/identity/provisioning-directories/:key` | Session or API client | Yes | — | — | `modules/platform-admin/routes/identity-provisioning.ts:147` |
| GET | `/api/identity/provisioning-directories/:key/credentials` | Session or API client | No | — | — | `modules/platform-admin/routes/identity-provisioning.ts:181` |
| POST | `/api/identity/provisioning-directories/:key/credentials` | Session or API client | Yes | — | `Idempotency-Key` (API-client callers) | `modules/platform-admin/routes/identity-provisioning.ts:186` |
| DELETE | `/api/identity/provisioning-directories/:key/credentials/:credentialId` | Session or API client | Yes | — | — | `modules/platform-admin/routes/identity-provisioning.ts:229` |
| POST | `/api/identity/provisioning-directories/:key/credentials/:credentialId/rotate` | Session or API client | Yes | — | `Idempotency-Key` (API-client callers) | `modules/platform-admin/routes/identity-provisioning.ts:207` |
| GET | `/api/identity/provisioning-directories/:key/events` | Session or API client | No | — | — | `modules/platform-admin/routes/identity-provisioning.ts:243` |
| POST | `/api/identity/provisioning-directories/:key/test` | Session or API client | Yes | — | — | `modules/platform-admin/routes/identity-provisioning.ts:161` |

### `/api/invitations` (3)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/invitations/:token` | Public | No | — | — | `modules/invitations/routes/invitations.ts:171` |
| POST | `/api/invitations/:token/redeem` | Public | Conditional | — | — | `modules/invitations/routes/invitations.ts:252` |
| POST | `/api/invitations/:token/verify-otp` | Public | Conditional | — | — | `modules/invitations/routes/invitations.ts:212` |

### `/api/mission-control` (1)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| POST | `/api/mission-control/bridge/starbase-edit/evaluate` | Session | Yes | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:51` |

### `/api/notifications` (5)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/notifications` | Session | No | `/t/:tenantSlug` prefix | — | `modules/notifications/routes/notifications.ts:51` |
| POST | `/api/notifications` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/notifications/routes/notifications.ts:118` |
| DELETE | `/api/notifications` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/notifications/routes/notifications.ts:176` |
| DELETE | `/api/notifications/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/notifications/routes/notifications.ts:196` |
| PATCH | `/api/notifications/read` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/notifications/routes/notifications.ts:149` |

### `/api/platform` (2)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/platform/tenants` | Session | No | — | — | `modules/tenancy/routes/tenants.ts:463` |
| POST | `/api/platform/tenants` | Session | Yes | — | — | `modules/tenancy/routes/tenants.ts:467` |

### `/api/plugin-platform` (16)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/plugin-platform/v1/audit` | Session | No | — | — | `plugins/pluginControlRoutes.ts:168` |
| GET | `/api/plugin-platform/v1/capabilities` | Session | No | — | — | `plugins/pluginControlRoutes.ts:116` |
| GET | `/api/plugin-platform/v1/catalog` | Session | No | — | — | `plugins/pluginManagerBrowserRoutes.ts:89` |
| GET | `/api/plugin-platform/v1/deployment-execution` | Session | No | — | — | `plugins/pluginControlRoutes.ts:141` |
| GET | `/api/plugin-platform/v1/emergency-control` | Session | No | — | — | `plugins/pluginControlRoutes.ts:133` |
| PUT | `/api/plugin-platform/v1/emergency-control` | Session | Yes | — | — | `plugins/pluginControlRoutes.ts:149` |
| GET | `/api/plugin-platform/v1/events/dead-letters` | Session | No | — | — | `plugins/pluginControlRoutes.ts:196` |
| GET | `/api/plugin-platform/v1/installations` | Session | No | — | — | `plugins/pluginManagerBrowserRoutes.ts:119` |
| POST | `/api/plugin-platform/v1/installations` | Session | Yes | — | — | `plugins/pluginManagerBrowserRoutes.ts:146` |
| GET | `/api/plugin-platform/v1/installations/:installationId` | Session | No | — | — | `plugins/pluginManagerBrowserRoutes.ts:133` |
| POST | `/api/plugin-platform/v1/installations/:installationId/approval` | Session | Yes | — | — | `plugins/pluginManagerBrowserRoutes.ts:171` |
| GET | `/api/plugin-platform/v1/manager` | Session | No | — | — | `plugins/pluginManagerBrowserRoutes.ts:101` |
| GET | `/api/plugin-platform/v1/plugins` | Session | No | — | — | `plugins/pluginControlRoutes.ts:125` |
| POST | `/api/plugin-platform/v1/plugins/:pluginId/disable` | Session | Yes | — | — | `plugins/pluginControlRoutes.ts:285` |
| POST | `/api/plugin-platform/v1/plugins/:pluginId/enable` | Session | Yes | — | — | `plugins/pluginControlRoutes.ts:236` |
| POST | `/api/plugin-platform/v1/plugins/:pluginId/events/dead-letters/:deliveryId/requeue` | Session | Yes | — | — | `plugins/pluginControlRoutes.ts:254` |

### `/api/plugins` (5)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/plugins/v1/:pluginId/operations/:operationId` | Session | No | From session | — | `plugins/pluginRuntime.ts:1913` |
| POST | `/api/plugins/v1/:pluginId/operations/:operationId` | Session | Yes | From session | — | `plugins/pluginRuntime.ts:1913` |
| PUT | `/api/plugins/v1/:pluginId/operations/:operationId` | Session | Yes | From session | — | `plugins/pluginRuntime.ts:1913` |
| PATCH | `/api/plugins/v1/:pluginId/operations/:operationId` | Session | Yes | From session | — | `plugins/pluginRuntime.ts:1913` |
| DELETE | `/api/plugins/v1/:pluginId/operations/:operationId` | Session | Yes | From session | — | `plugins/pluginRuntime.ts:1913` |

### `/api/starbase` (1)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| POST | `/api/starbase/bridge/mission-control/evaluate` | Session | Yes | — | — | `modules/platform-admin/routes/authz/project-engine-targets.ts:55` |

### `/api/t/:tenantSlug/apps` (6)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/t/:tenantSlug/apps` | Session | No | In path | — | `plugins/pluginControlRoutes.ts:362` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/activate` | Session | Yes | In path | — | `plugins/pluginControlRoutes.ts:501` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/activation-request` | Session | Yes | In path | — | `plugins/pluginControlRoutes.ts:445` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/activation-request/decision` | Session | Yes | In path | — | `plugins/pluginControlRoutes.ts:464` |
| GET | `/api/t/:tenantSlug/apps/:pluginId/audit` | Session | No | In path | — | `plugins/pluginControlRoutes.ts:402` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/deactivate` | Session | Yes | In path | — | `plugins/pluginControlRoutes.ts:506` |

### `/api/t/:tenantSlug/auth` (8)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| POST | `/api/t/:tenantSlug/auth/complete-onboarding` | Onboarding cookie | Conditional | In path | — | `modules/auth/routes/onboarding.ts:101` |
| POST | `/api/t/:tenantSlug/auth/login` | Public | Conditional | In path | — | `modules/auth/routes/login.ts:339` |
| GET | `/api/t/:tenantSlug/auth/login-methods` | Public | No | In path | — | `modules/auth/routes/identity-oidc.ts:554` |
| GET | `/api/t/:tenantSlug/auth/onboarding/login-methods` | Onboarding cookie | No | In path | — | `modules/auth/routes/identity-oidc.ts:547` |
| POST | `/api/t/:tenantSlug/auth/onboarding/providers/:providerId/login` | Onboarding cookie | Conditional | In path | — | `modules/auth/routes/identity-oidc.ts:549` |
| GET | `/api/t/:tenantSlug/auth/onboarding/providers/:providerId/start` 🔗 | Onboarding cookie | No | In path | — | `modules/auth/routes/identity-oidc.ts:548` |
| POST | `/api/t/:tenantSlug/auth/providers/:providerId/login` | Public | Conditional | In path | — | `modules/auth/routes/identity-oidc.ts:556` |
| GET | `/api/t/:tenantSlug/auth/providers/:providerId/start` 🔗 | Public | No | In path | — | `modules/auth/routes/identity-oidc.ts:555` |

### `/api/t/:tenantSlug/invitations` (5)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| POST | `/api/t/:tenantSlug/invitations` | Session | Yes | In path | — | `modules/invitations/routes/invitations.ts:100` |
| GET | `/api/t/:tenantSlug/invitations/:token` | Public | No | In path | — | `modules/invitations/routes/invitations.ts:172` |
| POST | `/api/t/:tenantSlug/invitations/:token/redeem` | Public | Conditional | In path | — | `modules/invitations/routes/invitations.ts:253` |
| POST | `/api/t/:tenantSlug/invitations/:token/verify-otp` | Public | Conditional | In path | — | `modules/invitations/routes/invitations.ts:213` |
| GET | `/api/t/:tenantSlug/invitations/capabilities` | Session | No | In path | — | `modules/invitations/routes/invitations.ts:90` |

### `/api/t/:tenantSlug/tenant` (9)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/t/:tenantSlug/tenant/discovery-domains` | Session | No | In path | — | `modules/tenancy/routes/tenants.ts:554` |
| POST | `/api/t/:tenantSlug/tenant/discovery-domains` | Session | Yes | In path | — | `modules/tenancy/routes/tenants.ts:558` |
| DELETE | `/api/t/:tenantSlug/tenant/discovery-domains/:domainId` | Session | Yes | In path | — | `modules/tenancy/routes/tenants.ts:579` |
| POST | `/api/t/:tenantSlug/tenant/discovery-domains/:domainId/verify` | Session | Yes | In path | — | `modules/tenancy/routes/tenants.ts:571` |
| GET | `/api/t/:tenantSlug/tenant/login-policy` | Session | No | In path | — | `modules/tenancy/routes/tenants.ts:517` |
| PUT | `/api/t/:tenantSlug/tenant/login-policy` | Session | Yes | In path | — | `modules/tenancy/routes/tenants.ts:525` |
| GET | `/api/t/:tenantSlug/tenant/members` | Session | No | In path | — | `modules/tenancy/routes/tenants.ts:584` |
| PUT | `/api/t/:tenantSlug/tenant/members/:userId` | Session | Yes | In path | — | `modules/tenancy/routes/tenants.ts:588` |
| DELETE | `/api/t/:tenantSlug/tenant/members/:userId` | Session | Yes | In path | — | `modules/tenancy/routes/tenants.ts:594` |

### `/api/tenancy` (1)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/tenancy/capabilities` | Public | No | — | — | `modules/tenancy/routes/tenants.ts:135` |

### `/api/users` (15)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/api/users` | Session | No | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:28` |
| POST | `/api/users` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:39` |
| GET | `/api/users/:id` | Session | No | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:124` |
| PUT | `/api/users/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:136` |
| DELETE | `/api/users/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:152` |
| GET | `/api/users/:id/audit` | Session | No | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:101` |
| POST | `/api/users/:id/deactivate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:105` |
| GET | `/api/users/:id/effective-access` | Session | No | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:93` |
| GET | `/api/users/:id/identity-context` | Session | No | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:89` |
| DELETE | `/api/users/:id/permanent` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:167` |
| POST | `/api/users/:id/reactivate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:111` |
| POST | `/api/users/:id/revoke-sessions` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:115` |
| GET | `/api/users/:id/sessions` | Session | No | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:97` |
| POST | `/api/users/:id/unlock` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:188` |
| GET | `/api/users/directory` | Session | No | `/t/:tenantSlug` prefix | — | `modules/users/routes/users.ts:82` |

### `/engines-api` (48)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/engines-api/engines` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1145` |
| POST | `/engines-api/engines` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1177` |
| GET | `/engines-api/engines/:engineId/access-requests` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:883` |
| POST | `/engines-api/engines/:engineId/access-requests/:requestId/approve` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:909` |
| POST | `/engines-api/engines/:engineId/access-requests/:requestId/deny` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:937` |
| POST | `/engines-api/engines/:engineId/delegate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:632` |
| GET | `/engines-api/engines/:engineId/deployment-history` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/deployments.ts:825` |
| GET | `/engines-api/engines/:engineId/deployment-receipts` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/deployments.ts:819` |
| POST | `/engines-api/engines/:engineId/deployments` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/deployments.ts:763` |
| GET | `/engines-api/engines/:engineId/deployments/:deploymentId/lineage` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/deployments.ts:853` |
| POST | `/engines-api/engines/:engineId/environment` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:720` |
| GET | `/engines-api/engines/:engineId/members` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:240` |
| POST | `/engines-api/engines/:engineId/members` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:338` |
| PATCH | `/engines-api/engines/:engineId/members/:userId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:467` |
| DELETE | `/engines-api/engines/:engineId/members/:userId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:507` |
| GET | `/engines-api/engines/:engineId/members/capabilities` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:260` |
| GET | `/engines-api/engines/:engineId/members/lookup` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:277` |
| POST | `/engines-api/engines/:engineId/pending-invites/:invitationId/reissue` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:544` |
| POST | `/engines-api/engines/:engineId/request-access` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:849` |
| PUT | `/engines-api/engines/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2339` |
| DELETE | `/engines-api/engines/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2468` |
| GET | `/engines-api/engines/:id/backstop/mappings` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1924` |
| POST | `/engines-api/engines/:id/backstop/mappings` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1931` |
| GET | `/engines-api/engines/:id/backstop/status` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1912` |
| GET | `/engines-api/engines/:id/backstop/sync` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1955` |
| POST | `/engines-api/engines/:id/backstop/sync/:runId/apply` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1977` |
| POST | `/engines-api/engines/:id/backstop/sync/:runId/drift-check` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1997` |
| POST | `/engines-api/engines/:id/backstop/sync/:runId/rollback` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1987` |
| POST | `/engines-api/engines/:id/backstop/sync/preview` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1940` |
| GET | `/engines-api/engines/:id/camunda-native-grants/imports` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1889` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/apply` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2059` |
| GET | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/detail` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1904` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/draft` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2007` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/rollback` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2154` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/rollback/preview` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2126` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/preview` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:1841` |
| GET | `/engines-api/engines/:id/health` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2540` |
| GET | `/engines-api/engines/:id/project-targets` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2196` |
| POST | `/engines-api/engines/:id/tenancy/apply` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2252` |
| GET | `/engines-api/engines/:id/tenancy/diagnostics` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2211` |
| POST | `/engines-api/engines/:id/tenancy/preview` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2215` |
| GET | `/engines-api/engines/:id/tenant-mappings` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2297` |
| PUT | `/engines-api/engines/:id/tenant-mappings` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2310` |
| POST | `/engines-api/engines/:id/test` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2523` |
| GET | `/engines-api/environment-tags` | Session | No | `/t/:tenantSlug` prefix | — | `modules/engines/routes/management.ts:778` |
| GET | `/engines-api/saved-filters` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2593` |
| POST | `/engines-api/saved-filters` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2605` |
| DELETE | `/engines-api/saved-filters/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/engines/routes.ts:2664` |

### `/git-api` (35)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/git-api/admin/providers` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/providers.ts:102` |
| PUT | `/git-api/admin/providers/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/providers.ts:159` |
| POST | `/git-api/clone` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/clone.ts:117` |
| GET | `/git-api/commits` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/deployments.ts:238` |
| POST | `/git-api/create-online` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/createOnline.ts:54` |
| GET | `/git-api/credentials` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:68` |
| POST | `/git-api/credentials` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:95` |
| PATCH | `/git-api/credentials/:credentialId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:114` |
| GET | `/git-api/credentials/:credentialId/namespaces` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:156` |
| DELETE | `/git-api/credentials/:providerId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:132` |
| GET | `/git-api/credentials/:providerId/validate` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:144` |
| POST | `/git-api/deploy` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/deployments.ts:34` |
| GET | `/git-api/deployments` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/deployments.ts:162` |
| GET | `/git-api/deployments/:id` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/deployments.ts:196` |
| GET | `/git-api/locks` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/locks.ts:142` |
| POST | `/git-api/locks` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/locks.ts:42` |
| DELETE | `/git-api/locks/:lockId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/locks.ts:103` |
| PUT | `/git-api/locks/:lockId/heartbeat` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/locks.ts:162` |
| GET | `/git-api/oauth/:providerId/authorize/redirect` 🔗 | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:197` |
| POST | `/git-api/oauth/callback` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/credentials.ts:258` |
| GET | `/git-api/project-connection` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/gitConnection.ts:47` |
| POST | `/git-api/project-connection` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/gitConnection.ts:89` |
| DELETE | `/git-api/project-connection` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/gitConnection.ts:229` |
| PUT | `/git-api/project-connection/token` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/gitConnection.ts:172` |
| GET | `/git-api/providers` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/providers.ts:42` |
| GET | `/git-api/providers/:id/repos` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/providers.ts:190` |
| POST | `/git-api/repo-info` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/clone.ts:48` |
| GET | `/git-api/repositories` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/repositories.ts:61` |
| GET | `/git-api/repositories/:id` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/repositories.ts:111` |
| DELETE | `/git-api/repositories/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/repositories.ts:149` |
| POST | `/git-api/repositories/clone` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/repositories.ts:47` |
| POST | `/git-api/repositories/init` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/repositories.ts:34` |
| POST | `/git-api/rollback` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/deployments.ts:222` |
| POST | `/git-api/sync` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/git/routes/sync.ts:115` |
| GET | `/git-api/sync/status` | Session | No | `/t/:tenantSlug` prefix | — | `modules/git/routes/sync.ts:56` |

### `/mission-control-api` (48)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| GET | `/mission-control-api/batches` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:175` |
| GET | `/mission-control-api/batches/:id` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:259` |
| DELETE | `/mission-control-api/batches/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:444` |
| DELETE | `/mission-control-api/batches/:id/record` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:463` |
| PUT | `/mission-control-api/batches/:id/suspended` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:215` |
| POST | `/mission-control-api/batches/jobs/retries` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:153` |
| POST | `/mission-control-api/batches/process-instances/activate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:145` |
| POST | `/mission-control-api/batches/process-instances/delete` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:119` |
| POST | `/mission-control-api/batches/process-instances/suspend` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/batches/routes.ts:136` |
| GET | `/mission-control-api/decision-definitions` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/decisions/routes.ts:81` |
| GET | `/mission-control-api/decision-definitions/:id` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/decisions/routes.ts:101` |
| GET | `/mission-control-api/decision-definitions/:id/xml` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/decisions/routes.ts:109` |
| GET | `/mission-control-api/decision-definitions/edit-target` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/decisions/routes.ts:41` |
| POST | `/mission-control-api/decision-definitions/key/:key/evaluate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/decisions/routes.ts:125` |
| GET | `/mission-control-api/history/decisions` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/history-extended.ts:69` |
| GET | `/mission-control-api/history/decisions/:id/inputs` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/history-extended.ts:86` |
| GET | `/mission-control-api/history/decisions/:id/outputs` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/history-extended.ts:99` |
| GET | `/mission-control-api/history/process-instances/:id` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:315` |
| GET | `/mission-control-api/history/variable-instances` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:378` |
| POST | `/mission-control-api/migration/active-sources` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/migration/routes.ts:102` |
| POST | `/mission-control-api/migration/execute-async` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/migration/routes.ts:80` |
| POST | `/mission-control-api/migration/execute-direct` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/migration/routes.ts:91` |
| POST | `/mission-control-api/migration/generate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/migration/routes.ts:65` |
| POST | `/mission-control-api/migration/plan/validate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/migration/routes.ts:69` |
| POST | `/mission-control-api/migration/preview` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/migration/routes.ts:35` |
| GET | `/mission-control-api/process-definitions` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:96` |
| GET | `/mission-control-api/process-definitions/:id/active-activity-counts` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:165` |
| GET | `/mission-control-api/process-definitions/:id/activity-counts-by-state` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:178` |
| GET | `/mission-control-api/process-definitions/:id/xml` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:153` |
| GET | `/mission-control-api/process-definitions/edit-target` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/processes/routes.ts:85` |
| POST | `/mission-control-api/process-definitions/key/:key/start` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/processes/routes.ts:152` |
| GET | `/mission-control-api/process-instances` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:209` |
| GET | `/mission-control-api/process-instances/:id` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:240` |
| DELETE | `/mission-control-api/process-instances/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:429` |
| PUT | `/mission-control-api/process-instances/:id/activate` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:418` |
| GET | `/mission-control-api/process-instances/:id/activity-instances` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/process-instances/routes.ts:100` |
| GET | `/mission-control-api/process-instances/:id/execution-details` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:285` |
| GET | `/mission-control-api/process-instances/:id/failed-external-tasks` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:442` |
| GET | `/mission-control-api/process-instances/:id/history/activity-instances` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:273` |
| GET | `/mission-control-api/process-instances/:id/incidents` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:365` |
| GET | `/mission-control-api/process-instances/:id/jobs` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:302` |
| POST | `/mission-control-api/process-instances/:id/modify` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/modify.ts:38` |
| POST | `/mission-control-api/process-instances/:id/retry` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:454` |
| PUT | `/mission-control-api/process-instances/:id/suspend` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:407` |
| GET | `/mission-control-api/process-instances/:id/variable-history` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:352` |
| GET | `/mission-control-api/process-instances/:id/variables` | Session | No | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:261` |
| POST | `/mission-control-api/process-instances/:id/variables` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/process-instances/routes.ts:121` |
| POST | `/mission-control-api/process-instances/preview-count` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/mission-control/shared/mission_control.ts:192` |

### `/starbase-api` (49)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| DELETE | `/starbase-api/deployments/:id` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/deployments.ts:38` |
| GET | `/starbase-api/files/:fileId` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:250` |
| PUT | `/starbase-api/files/:fileId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:375` |
| PATCH | `/starbase-api/files/:fileId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:580` |
| DELETE | `/starbase-api/files/:fileId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:665` |
| GET | `/starbase-api/files/:fileId/comments` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/comments.ts:20` |
| GET | `/starbase-api/files/:fileId/download` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:353` |
| POST | `/starbase-api/files/:fileId/restore-from-commit` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:458` |
| GET | `/starbase-api/files/:fileId/versions` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/versions.ts:55` |
| POST | `/starbase-api/files/:fileId/versions` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/versions.ts:99` |
| GET | `/starbase-api/files/:fileId/versions/:versionId` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/versions.ts:135` |
| POST | `/starbase-api/files/:fileId/versions/:versionId/restore` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/versions.ts:160` |
| PATCH | `/starbase-api/folders/:folderId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:446` |
| DELETE | `/starbase-api/folders/:folderId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:551` |
| GET | `/starbase-api/folders/:folderId/delete-preview` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:503` |
| GET | `/starbase-api/folders/:folderId/download` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:582` |
| GET | `/starbase-api/projects` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:187` |
| POST | `/starbase-api/projects` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:372` |
| PATCH | `/starbase-api/projects/:projectId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:474` |
| DELETE | `/starbase-api/projects/:projectId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:491` |
| GET | `/starbase-api/projects/:projectId/contents` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:326` |
| GET | `/starbase-api/projects/:projectId/deployment-targets` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:506` |
| POST | `/starbase-api/projects/:projectId/deployment-targets` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:524` |
| PUT | `/starbase-api/projects/:projectId/deployment-targets/:targetId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:540` |
| DELETE | `/starbase-api/projects/:projectId/deployment-targets/:targetId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:555` |
| POST | `/starbase-api/projects/:projectId/deployment-targets/sync-legacy` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:516` |
| GET | `/starbase-api/projects/:projectId/download` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:644` |
| POST | `/starbase-api/projects/:projectId/download-selection` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:714` |
| GET | `/starbase-api/projects/:projectId/engine-access` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:570` |
| GET | `/starbase-api/projects/:projectId/engine-deployments/latest` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/engine-deployments.ts:51` |
| GET | `/starbase-api/projects/:projectId/files` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:135` |
| POST | `/starbase-api/projects/:projectId/files` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:170` |
| GET | `/starbase-api/projects/:projectId/files/:fileId/callers` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/files.ts:294` |
| GET | `/starbase-api/projects/:projectId/files/:fileId/deployments/history` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/engine-deployments.ts:40` |
| GET | `/starbase-api/projects/:projectId/folders` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:384` |
| POST | `/starbase-api/projects/:projectId/folders` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:402` |
| POST | `/starbase-api/projects/:projectId/import-zip` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/folders.ts:690` |
| GET | `/starbase-api/projects/:projectId/members` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:446` |
| POST | `/starbase-api/projects/:projectId/members` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:590` |
| PATCH | `/starbase-api/projects/:projectId/members/:userId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:734` |
| DELETE | `/starbase-api/projects/:projectId/members/:userId` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:795` |
| PUT | `/starbase-api/projects/:projectId/members/:userId/deploy-permission` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:373` |
| GET | `/starbase-api/projects/:projectId/members/capabilities` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:351` |
| GET | `/starbase-api/projects/:projectId/members/lookup` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:295` |
| GET | `/starbase-api/projects/:projectId/members/me` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:893` |
| GET | `/starbase-api/projects/:projectId/members/user-search` | Session | No | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:246` |
| POST | `/starbase-api/projects/:projectId/pending-invites/:invitationId/reissue` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:503` |
| POST | `/starbase-api/projects/:projectId/transfer-ownership` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/members.ts:852` |
| POST | `/starbase-api/projects/import-preview` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/starbase/routes/projects.ts:460` |

### `/vcs-api` (7)

| Method | Path | Auth | X-XSRF-TOKEN | Tenant | Other required | Backend route |
|---|---|---|---|---|---|---|
| POST | `/vcs-api/projects/:projectId/commit` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/versioning/index.ts:92` |
| GET | `/vcs-api/projects/:projectId/commits` | Session | No | `/t/:tenantSlug` prefix | — | `modules/versioning/index.ts:211` |
| GET | `/vcs-api/projects/:projectId/commits/:commitId/files` | Session | No | `/t/:tenantSlug` prefix | — | `modules/versioning/index.ts:563` |
| POST | `/vcs-api/projects/:projectId/commits/:commitId/restore` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/versioning/index.ts:585` |
| POST | `/vcs-api/projects/:projectId/publish` | Session | Yes | `/t/:tenantSlug` prefix | — | `modules/versioning/index.ts:179` |
| GET | `/vcs-api/projects/:projectId/uncommitted-files` | Session | No | `/t/:tenantSlug` prefix | — | `modules/versioning/index.ts:520` |
| GET | `/vcs-api/projects/uncommitted-status` | Session | No | `/t/:tenantSlug` prefix | — | `modules/versioning/index.ts:43` |
