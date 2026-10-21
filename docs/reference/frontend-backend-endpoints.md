# Frontend to Backend Endpoint Inventory

Summary: Every EnterpriseGlue backend HTTP endpoint the frontend calls, with the
backend route definition and the frontend call sites, plus frontend calls that
have no matching backend route.

Audience: Frontend and backend developers changing or reviewing API contracts.

Snapshot taken at commit `3d98390` (2026-10-21). Routes added or changed after that commit are not reflected. A CSV version of the same data is in [frontend-backend-endpoints.csv](frontend-backend-endpoints.csv).

**446 distinct endpoints** (method + route) across 25 groups, called from 87 frontend files.

## How this was built

- The frontend app is `packages/frontend-host` (the `frontend/` folder is a thin shell that calls `startApp()`). Every call through `apiClient.*`, `fetchList`, `fetch`/`apiFetch`, the Git API class, plus `window.location.assign`/`window.open` redirects to backend URLs, was parsed with the TypeScript compiler and its URL resolved through local constants and helper functions.
- Each call was then matched to an Express route in `packages/backend-host/src`. The **Backend route** column is the route pattern and where it is defined; **Frontend callers** are `file:line` under `packages/frontend-host/src`.
- Tenant prefix: `utils/httpInterceptor.ts` automatically prefixes tenant-scoped paths (`/starbase-api`, `/mission-control-api`, `/engines-api`, `/git-api`, `/vcs-api`, `/api/users`, `/api/audit`, `/api/notifications`, `/api/dashboard`, `/api/identity/providers`) with `/t/:tenantSlug` when the user is inside a tenant. Paths below are shown without that prefix. Platform paths (`/api/auth`, `/api/admin`, `/api/authz`, …) are never prefixed.
- Query strings are omitted. "(nav)" marks a full-page browser navigation (OAuth/SSO redirects, downloads) rather than an XHR call.
- Not included: the Operaton REST API the backend calls on the frontend's behalf, and backend routes the frontend never calls (SCIM, internal plugin-manager routes, `/metrics`, `/ready`).

## Calls with no matching backend route

These frontend calls have no backend route, so they would return 404:

| Method | Path | Caller | Notes |
|---|---|---|---|
| GET | `/starbase-api/projects/:id` | `api/starbase/projects.ts:24` | `projectsApi.getById` has no callers. Dead code. |
| GET | `/mission-control-api/batches/:id/statistics` | `features/mission-control/batches/api/batches.ts:40` | `getBatchStatistics` has no callers (statistics come back inside `GET /mission-control-api/batches/:id`). Dead code. |
| GET | `/vcs-api/projects/:id/commits/:id/snapshots` | `features/starbase/pages/Editor.tsx:1726` | **Live bug.** The editor's view mode (`viewSnapshotQ`) calls `/snapshots`, but the backend serves this at `GET /vcs-api/projects/:projectId/commits/:commitId/files` (`modules/versioning/index.ts:563`). |

## Summary by group

| Group | Endpoints |
|---|---|
| `/api/admin` | 30 |
| `/api/audit` | 3 |
| `/api/auth` | 37 |
| `/api/authz` | 78 |
| `/api/dashboard` | 2 |
| `/api/identity` | 31 |
| `/api/invitations` | 3 |
| `/api/mission-control` | 1 |
| `/api/notifications` | 5 |
| `/api/platform` | 2 |
| `/api/plugin-platform` | 16 |
| `/api/plugins` | 5 |
| `/api/starbase` | 1 |
| `/api/t/:tenantSlug/apps` | 6 |
| `/api/t/:tenantSlug/auth` | 8 |
| `/api/t/:tenantSlug/invitations` | 5 |
| `/api/t/:tenantSlug/tenant` | 9 |
| `/api/tenancy` | 1 |
| `/api/users` | 15 |
| `/_enterpriseglue` | 1 |
| `/engines-api` | 48 |
| `/git-api` | 35 |
| `/mission-control-api` | 48 |
| `/starbase-api` | 49 |
| `/vcs-api` | 7 |

## `/api/admin`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/admin/branding` | `modules/platform-admin/routes/branding.ts:51` | `features/platform-admin/components/BrandingSettingsTab.tsx:40` |
| PUT | `/api/admin/branding` | `modules/platform-admin/routes/branding.ts:65` | `features/platform-admin/components/BrandingSettingsTab.tsx:46` |
| DELETE | `/api/admin/branding` | `modules/platform-admin/routes/branding.ts:97` | `features/platform-admin/components/BrandingSettingsTab.tsx:53` |
| GET | `/api/admin/email-configs` | `modules/admin/routes/email-configs.ts:40` | `pages/admin/EmailConfigurations.tsx:125` |
| POST | `/api/admin/email-configs` | `modules/admin/routes/email-configs.ts:92` | `pages/admin/EmailConfigurations.tsx:131` |
| PATCH | `/api/admin/email-configs/:id` | `modules/admin/routes/email-configs.ts:157` | `pages/admin/EmailConfigurations.tsx:148` |
| DELETE | `/api/admin/email-configs/:id` | `modules/admin/routes/email-configs.ts:214` | `pages/admin/EmailConfigurations.tsx:165` |
| POST | `/api/admin/email-configs/:id/set-default` | `modules/admin/routes/email-configs.ts:248` | `pages/admin/EmailConfigurations.tsx:181` |
| POST | `/api/admin/email-configs/:id/test` | `modules/admin/routes/email-configs.ts:277` | `pages/admin/EmailConfigurations.tsx:196` |
| GET | `/api/admin/email-platform-name` | `modules/admin/routes/email-templates.ts:38` | `pages/admin/EmailTemplates.tsx:104` |
| PUT | `/api/admin/email-platform-name` | `modules/admin/routes/email-templates.ts:51` | `pages/admin/EmailTemplates.tsx:116` |
| GET | `/api/admin/email-templates` | `modules/admin/routes/email-templates.ts:81` | `pages/admin/EmailTemplates.tsx:137` |
| PATCH | `/api/admin/email-templates/:id` | `modules/admin/routes/email-templates.ts:129` | `pages/admin/EmailTemplates.tsx:143` |
| POST | `/api/admin/email-templates/:id/preview` | `modules/admin/routes/email-templates.ts:465` | `pages/admin/EmailTemplates.tsx:173` |
| POST | `/api/admin/email-templates/:id/reset` | `modules/admin/routes/email-templates.ts:184` | `pages/admin/EmailTemplates.tsx:159` |
| GET | `/api/admin/engines` | `modules/platform-admin/routes/governance.ts:137` | `api/platform-admin/admin.ts:96` |
| POST | `/api/admin/engines/:engineId/assign-delegate` | `modules/platform-admin/routes/governance.ts:286` | `api/platform-admin/admin.ts:102` |
| POST | `/api/admin/engines/:engineId/assign-owner` | `modules/platform-admin/routes/governance.ts:250` | `api/platform-admin/admin.ts:99` |
| GET | `/api/admin/environments` | `modules/platform-admin/routes/environments.ts:31` | `api/platform-admin/admin.ts:63` |
| POST | `/api/admin/environments` | `modules/platform-admin/routes/environments.ts:45` | `api/platform-admin/admin.ts:66` |
| PUT | `/api/admin/environments/:id` | `modules/platform-admin/routes/environments.ts:76` | `api/platform-admin/admin.ts:69` |
| DELETE | `/api/admin/environments/:id` | `modules/platform-admin/routes/environments.ts:109` | `api/platform-admin/admin.ts:72` |
| POST | `/api/admin/environments/reorder` | `modules/platform-admin/routes/environments.ts:144` | `api/platform-admin/admin.ts:75` |
| GET | `/api/admin/projects` | `modules/platform-admin/routes/governance.ts:100` | `api/platform-admin/admin.ts:86` |
| POST | `/api/admin/projects/:projectId/assign-delegate` | `modules/platform-admin/routes/governance.ts:214` | `api/platform-admin/admin.ts:92` |
| POST | `/api/admin/projects/:projectId/assign-owner` | `modules/platform-admin/routes/governance.ts:178` | `api/platform-admin/admin.ts:89` |
| GET | `/api/admin/settings` | `modules/platform-admin/routes/settings.ts:33` | `api/platform-admin/admin.ts:56` |
| PUT | `/api/admin/settings` | `modules/platform-admin/routes/settings.ts:47` | `api/platform-admin/admin.ts:59` |
| GET | `/api/admin/setup-status` | `modules/admin/routes/setup-status.ts:23` | `shared/components/ProtectedRoute.tsx:53` |
| GET | `/api/admin/users/search` | `modules/platform-admin/routes/governance.ts:66` | `api/platform-admin/admin.ts:82`, `features/mission-control/engines/components/EngineMembersModal.tsx:407`, `features/mission-control/engines/components/EngineMembersModal.tsx:418` +1 more |

## `/api/audit`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/audit/actions` | `modules/audit/routes/audit.ts:198` | `pages/AuditLogViewer.tsx:199` |
| GET | `/api/audit/logs` | `modules/audit/routes/audit.ts:61` | `pages/AuditLogViewer.tsx:174` |
| GET | `/api/audit/stats` | `modules/audit/routes/audit.ts:148` | `pages/AuditLogViewer.tsx:190` |

## `/api/auth`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/auth/branding` | `modules/auth/routes/me.ts:140` | `features/shared/components/LayoutWithProSidebar.tsx:499`, `shared/components/PublicAuthShell.tsx:109` |
| POST | `/api/auth/change-password` | `modules/auth/routes/password.ts:147` | `services/auth.ts:140` |
| POST | `/api/auth/cloud-passkey/complete` | `modules/auth/routes/cloud-email-passkey.ts:250` | `pages/CloudEmailAuth.tsx:64` |
| POST | `/api/auth/cloud-passkey/options` | `modules/auth/routes/cloud-email-passkey.ts:233` | `pages/CloudEmailAuth.tsx:31` |
| POST | `/api/auth/cloud-signup/email/passkey/complete` | `modules/auth/routes/cloud-email-passkey.ts:170` | `pages/CloudEmailAuth.tsx:60` |
| POST | `/api/auth/cloud-signup/email/passkey/options` | `modules/auth/routes/cloud-email-passkey.ts:150` | `pages/CloudEmailAuth.tsx:30` |
| POST | `/api/auth/cloud-signup/email/request` | `modules/auth/routes/cloud-email-passkey.ts:100` | `pages/CloudEmailAuth.tsx:46` |
| GET | `/api/auth/cloud-signup/providers` | `modules/auth/routes/identity-oidc.ts:408` | `pages/DocumentationAccess.tsx:45`, `pages/Login.tsx:198`, `pages/Signup.tsx:27` |
| GET (nav) | `/api/auth/cloud-signup/providers/:providerId/start` | `modules/auth/routes/identity-oidc.ts:421` | `pages/DocumentationAccess.tsx:63`, `pages/Login.tsx:699`, `pages/Signup.tsx:56` |
| POST | `/api/auth/complete-onboarding` | `modules/auth/routes/onboarding.ts:100` | `pages/AcceptInvite.tsx:202` |
| GET | `/api/auth/documentation/configuration` | `modules/auth/routes/documentation.ts:16` | `pages/DocumentationAccess.tsx:23` |
| POST | `/api/auth/documentation/grant` | `modules/auth/routes/documentation.ts:19` | `pages/DocumentationAccess.tsx:34` |
| POST | `/api/auth/forgot-password` | `modules/auth/routes/forgot-password.ts:37` | `services/auth.ts:119` |
| POST | `/api/auth/login` | `modules/auth/routes/login.ts:343` | `services/auth.ts:50` |
| GET | `/api/auth/login-methods` | `modules/auth/routes/identity-oidc.ts:558` | `pages/Login.tsx:179` |
| POST | `/api/auth/logout` | `modules/auth/routes/logout.ts:57` | `services/auth.ts:76` |
| GET | `/api/auth/me` | `modules/auth/routes/me.ts:35` | `services/auth.ts:94` |
| PATCH | `/api/auth/me` | `modules/auth/routes/me.ts:82` | `features/shared/components/LayoutWithProSidebar.tsx:476`, `pages/MyProfile.tsx:46` |
| GET | `/api/auth/me/identity-providers` | `modules/auth/routes/identity-oidc.ts:451` | `features/shared/components/LayoutWithProSidebar.tsx:218` |
| GET (nav) | `/api/auth/me/identity-providers/:providerId/link` | `modules/auth/routes/identity-oidc.ts:482` | `features/shared/components/LayoutWithProSidebar.tsx:225` |
| GET | `/api/auth/my-tenants` | `modules/tenancy/routes/tenants.ts:438` | `features/shared/components/NativeTenantPicker.tsx:23`, `pages/AuditLogViewer.tsx:108`, `pages/Login.tsx:283` +1 more |
| GET | `/api/auth/onboarding/login-methods` | `modules/auth/routes/identity-oidc.ts:544` | `pages/AcceptInvite.tsx:85` |
| POST | `/api/auth/onboarding/providers/:providerId/login` | `modules/auth/routes/identity-oidc.ts:546` | `pages/AcceptInvite.tsx:113` |
| GET (nav) | `/api/auth/onboarding/providers/:providerId/start` | `modules/auth/routes/identity-oidc.ts:545` | `pages/AcceptInvite.tsx:101` |
| GET | `/api/auth/platform-settings` | `modules/auth/routes/me.ts:188` | `features/mission-control/engines/EnginesPage.tsx:1582`, `features/platform-admin/hooks/usePlatformSyncSettings.ts:10` |
| POST | `/api/auth/providers/:providerId/login` | `modules/auth/routes/identity-oidc.ts:560` | `pages/Login.tsx:525` |
| GET (nav) | `/api/auth/providers/:providerId/start` | `modules/auth/routes/identity-oidc.ts:559` | `pages/Login.tsx:371` |
| POST | `/api/auth/recovery/login` | `modules/auth/routes/login.ts:351` | `pages/Login.tsx:432` |
| POST | `/api/auth/refresh` | `modules/auth/routes/refresh.ts:41` | `services/auth.ts:83`, `utils/httpInterceptor.ts:139` |
| POST | `/api/auth/resend-verification` | `modules/auth/routes/verify-email.ts:81` | `pages/ResendVerification.tsx:62` |
| POST | `/api/auth/reset-password` | `modules/auth/routes/password.ts:38` | `services/auth.ts:112` |
| POST | `/api/auth/reset-password-with-token` | `modules/auth/routes/forgot-password.ts:92` | `services/auth.ts:133` |
| POST | `/api/auth/switch-tenant` | `modules/tenancy/routes/tenants.ts:443` | `features/platform-admin/pages/TenantsPage.tsx:38`, `features/platform-admin/pages/TenantsPage.tsx:66`, `features/shared/components/NativeTenantPicker.tsx:29` +2 more |
| POST | `/api/auth/tenant-discovery` | `modules/tenancy/routes/tenants.ts:428` | `pages/Login.tsx:340` |
| POST | `/api/auth/tenant-discovery/exchange` | `modules/tenancy/routes/tenants.ts:432` | `pages/Login.tsx:311` |
| GET | `/api/auth/verify-email` | `modules/auth/routes/verify-email.ts:20` | `pages/VerifyEmail.tsx:33` |
| GET | `/api/auth/verify-reset-token` | `modules/auth/routes/forgot-password.ts:158` | `services/auth.ts:126` |

## `/api/authz`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/authz/api-clients` | `modules/platform-admin/routes/authz/machines.ts:25` | `features/platform-admin/hooks/useAuthzApi.ts:496` |
| POST | `/api/authz/api-clients` | `modules/platform-admin/routes/authz/machines.ts:35` | `features/platform-admin/hooks/useAuthzApi.ts:503` |
| DELETE | `/api/authz/api-clients/:id` | `modules/platform-admin/routes/authz/machines.ts:56` | `features/platform-admin/hooks/useAuthzApi.ts:519` |
| POST | `/api/authz/api-clients/:id/rotate` | `modules/platform-admin/routes/authz/machines.ts:46` | `features/platform-admin/hooks/useAuthzApi.ts:511` |
| GET | `/api/authz/audit` | `modules/platform-admin/routes/authz/audit.ts:38` | `features/platform-admin/hooks/useAuthzApi.ts:1021` |
| POST | `/api/authz/check` | `modules/platform-admin/routes/authz.ts:120` | `features/platform-admin/hooks/useAuthzApi.ts:998` |
| POST | `/api/authz/config-bundles/apply` | `modules/platform-admin/routes/authz/config-bundles.ts:154` | `features/platform-admin/components/ConfigurationBundleSettingsTab.tsx:152` |
| POST | `/api/authz/config-bundles/diff` | `modules/platform-admin/routes/authz/config-bundles.ts:143` | `features/platform-admin/components/ConfigurationBundleSettingsTab.tsx:143` |
| GET | `/api/authz/config-bundles/export` | `modules/platform-admin/routes/authz/config-bundles.ts:326` | `features/platform-admin/components/ConfigurationBundleSettingsTab.tsx:207` |
| GET | `/api/authz/config-bundles/governance-ownership` | `modules/platform-admin/routes/authz/config-bundles.ts:195` | `features/platform-admin/hooks/useAuthzApi.ts:786` |
| POST | `/api/authz/config-bundles/governance-ownership/apply` | `modules/platform-admin/routes/authz/config-bundles.ts:220` | `features/platform-admin/components/GovernanceOwnershipPanel.tsx:115` |
| POST | `/api/authz/config-bundles/governance-ownership/preview` | `modules/platform-admin/routes/authz/config-bundles.ts:199` | `features/platform-admin/components/GovernanceOwnershipPanel.tsx:94` |
| GET | `/api/authz/config-bundles/governance-ownership/receipts` | `modules/platform-admin/routes/authz/config-bundles.ts:247` | `features/platform-admin/hooks/useAuthzApi.ts:795` |
| POST | `/api/authz/config-bundles/import-url` | `modules/platform-admin/routes/authz/config-bundles.ts:100` | `features/platform-admin/components/ConfigurationBundleSettingsTab.tsx:197` |
| POST | `/api/authz/config-bundles/import-zip` | `modules/platform-admin/routes/authz/config-bundles.ts:87` | `features/platform-admin/components/ConfigurationBundleSettingsTab.tsx:186` |
| POST | `/api/authz/config-bundles/preview` | `modules/platform-admin/routes/authz/config-bundles.ts:113` | `features/platform-admin/components/ConfigurationBundleSettingsTab.tsx:143` |
| GET | `/api/authz/config-bundles/runs` | `modules/platform-admin/routes/authz/config-bundles.ts:257` | `features/platform-admin/hooks/useAuthzApi.ts:754` |
| GET | `/api/authz/config-bundles/runs/:id` | `modules/platform-admin/routes/authz/config-bundles.ts:267` | `features/platform-admin/hooks/useAuthzApi.ts:762` |
| GET | `/api/authz/config-bundles/runs/:id/identity-replay-tasks` | `modules/platform-admin/routes/authz/config-bundles.ts:277` | `features/platform-admin/hooks/useAuthzApi.ts:770` |
| GET | `/api/authz/config-bundles/runs/:id/runtime-reconciliation-tasks` | `modules/platform-admin/routes/authz/config-bundles.ts:303` | `features/platform-admin/hooks/useAuthzApi.ts:778` |
| POST | `/api/authz/config-bundles/validate-secret-refs` | `modules/platform-admin/routes/authz/config-bundles.ts:119` | `features/platform-admin/components/ConfigurationBundleSettingsTab.tsx:168` |
| GET | `/api/authz/engine-sets` | `modules/platform-admin/routes/authz/engine-sets.ts:36` | `features/platform-admin/hooks/useAuthzApi.ts:661` |
| POST | `/api/authz/engine-sets` | `modules/platform-admin/routes/authz/engine-sets.ts:56` | `features/platform-admin/hooks/useAuthzApi.ts:678` |
| GET | `/api/authz/engine-sets/:id` | `modules/platform-admin/routes/authz/engine-sets.ts:67` | `features/platform-admin/hooks/useAuthzApi.ts:669` |
| PUT | `/api/authz/engine-sets/:id` | `modules/platform-admin/routes/authz/engine-sets.ts:79` | `features/platform-admin/hooks/useAuthzApi.ts:687` |
| DELETE | `/api/authz/engine-sets/:id` | `modules/platform-admin/routes/authz/engine-sets.ts:90` | `features/platform-admin/hooks/useAuthzApi.ts:698` |
| POST | `/api/authz/engine-sets/:id/materialize` | `modules/platform-admin/routes/authz/engine-sets.ts:101` | `features/platform-admin/hooks/useAuthzApi.ts:810` |
| POST | `/api/authz/engine-sets/preview` | `modules/platform-admin/routes/authz/engine-sets.ts:46` | `features/platform-admin/hooks/useAuthzApi.ts:803` |
| POST | `/api/authz/evaluate` | `modules/platform-admin/routes/authz.ts:305` | `features/platform-admin/hooks/useAuthzApi.ts:379` |
| GET | `/api/authz/external-engine-systems` | `modules/platform-admin/routes/authz/external-engine-systems.ts:75` | `features/platform-admin/hooks/useAuthzApi.ts:569` |
| POST | `/api/authz/external-engine-systems` | `modules/platform-admin/routes/authz/external-engine-systems.ts:96` | `features/platform-admin/hooks/useAuthzApi.ts:577` |
| PUT | `/api/authz/external-engine-systems/:id` | `modules/platform-admin/routes/authz/external-engine-systems.ts:124` | `features/platform-admin/hooks/useAuthzApi.ts:586` |
| DELETE | `/api/authz/external-engine-systems/:id` | `modules/platform-admin/routes/authz/external-engine-systems.ts:161` | `features/platform-admin/hooks/useAuthzApi.ts:597` |
| GET | `/api/authz/external-engines` | `modules/platform-admin/routes/authz/external-engines.ts:38` | `features/platform-admin/hooks/useAuthzApi.ts:562` |
| GET | `/api/authz/external-engines/:id/audit` | `modules/platform-admin/routes/authz/external-engines.ts:115` | `features/platform-admin/hooks/useAuthzApi.ts:612` |
| POST | `/api/authz/external-engines/:id/decommission` | `modules/platform-admin/routes/authz/external-engines.ts:133` | `features/platform-admin/hooks/useAuthzApi.ts:621` |
| POST | `/api/authz/external-engines/:id/reactivate` | `modules/platform-admin/routes/authz/external-engines.ts:165` | `features/platform-admin/hooks/useAuthzApi.ts:634` |
| POST | `/api/authz/external-engines/:id/reconcile` | `modules/platform-admin/routes/authz/external-engines.ts:206` | `features/platform-admin/hooks/useAuthzApi.ts:646` |
| GET | `/api/authz/group-memberships` | `modules/platform-admin/routes/authz/assignments.ts:312` | `features/platform-admin/hooks/useAuthzApi.ts:472`, `features/starbase/pages/ProjectDetail.tsx:958` |
| POST | `/api/authz/group-memberships` | `modules/platform-admin/routes/authz/assignments.ts:327` | `features/platform-admin/hooks/useAuthzApi.ts:480` |
| DELETE | `/api/authz/group-memberships/:id` | `modules/platform-admin/routes/authz/assignments.ts:343` | `features/platform-admin/hooks/useAuthzApi.ts:488` |
| GET | `/api/authz/groups` | `modules/platform-admin/routes/authz/assignments.ts:252` | `features/platform-admin/hooks/useAuthzApi.ts:433`, `features/starbase/pages/ProjectDetail.tsx:952` |
| POST | `/api/authz/groups` | `modules/platform-admin/routes/authz/assignments.ts:266` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:211`, `features/platform-admin/hooks/useAuthzApi.ts:442` |
| PUT | `/api/authz/groups/:id` | `modules/platform-admin/routes/authz/assignments.ts:282` | `features/platform-admin/hooks/useAuthzApi.ts:451` |
| DELETE | `/api/authz/groups/:id` | `modules/platform-admin/routes/authz/assignments.ts:297` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:229`, `features/platform-admin/hooks/useAuthzApi.ts:459` |
| GET | `/api/authz/me/permissions` | `modules/platform-admin/routes/authz.ts:198` | `features/platform-admin/hooks/useAuthzApi.ts:289`, `services/auth.ts:103` |
| GET | `/api/authz/permissions` | `modules/platform-admin/routes/authz/roles.ts:110` | `features/platform-admin/hooks/useAuthzApi.ts:296` |
| POST | `/api/authz/permissions` | `modules/platform-admin/routes/authz/roles.ts:114` | `features/platform-admin/hooks/useAuthzApi.ts:304` |
| GET | `/api/authz/policies` | `modules/platform-admin/routes/authz/policies.ts:18` | `features/platform-admin/hooks/useAuthzApi.ts:961` |
| POST | `/api/authz/policies` | `modules/platform-admin/routes/authz/policies.ts:28` | `features/platform-admin/hooks/useAuthzApi.ts:969` |
| PUT | `/api/authz/policies/:id` | `modules/platform-admin/routes/authz/policies.ts:49` | `features/platform-admin/hooks/useAuthzApi.ts:978` |
| DELETE | `/api/authz/policies/:id` | `modules/platform-admin/routes/authz/policies.ts:65` | `features/platform-admin/hooks/useAuthzApi.ts:986` |
| GET | `/api/authz/project-engine-targets` | `modules/platform-admin/routes/authz/project-engine-targets.ts:42` | `features/platform-admin/hooks/useAuthzApi.ts:832`, `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:170` |
| POST | `/api/authz/project-engine-targets` | `modules/platform-admin/routes/authz/project-engine-targets.ts:63` | `features/platform-admin/hooks/useAuthzApi.ts:847`, `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:196`, `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:198` |
| GET | `/api/authz/project-engine-targets/:id` | `modules/platform-admin/routes/authz/project-engine-targets.ts:67` | `features/platform-admin/hooks/useAuthzApi.ts:839` |
| PUT | `/api/authz/project-engine-targets/:id` | `modules/platform-admin/routes/authz/project-engine-targets.ts:71` | `features/platform-admin/hooks/useAuthzApi.ts:855`, `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:212` |
| DELETE | `/api/authz/project-engine-targets/:id` | `modules/platform-admin/routes/authz/project-engine-targets.ts:75` | `features/platform-admin/hooks/useAuthzApi.ts:866`, `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:222` |
| POST | `/api/authz/project-engine-targets/evaluate` | `modules/platform-admin/routes/authz/project-engine-targets.ts:47` | `features/platform-admin/hooks/useAuthzApi.ts:877` |
| POST | `/api/authz/project-engine-targets/sync-legacy` | `modules/platform-admin/routes/authz/project-engine-targets.ts:59` | `features/platform-admin/hooks/useAuthzApi.ts:885`, `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:231` |
| GET | `/api/authz/role-assignments` | `modules/platform-admin/routes/authz/assignments.ts:189` | `features/mission-control/engines/EnginesPage.tsx:1791`, `features/mission-control/engines/EnginesPage.tsx:1801`, `features/mission-control/engines/components/EngineMembersModal.tsx:395` +2 more |
| POST | `/api/authz/role-assignments` | `modules/platform-admin/routes/authz/assignments.ts:214` | `features/mission-control/engines/components/EngineMembersModal.tsx:583`, `features/mission-control/engines/components/EngineMembersModal.tsx:600`, `features/platform-admin/hooks/useAuthzApi.ts:413` +2 more |
| DELETE | `/api/authz/role-assignments/:id` | `modules/platform-admin/routes/authz/assignments.ts:240` | `features/mission-control/engines/components/EngineMembersModal.tsx:614`, `features/platform-admin/hooks/useAuthzApi.ts:421`, `features/starbase/pages/ProjectDetail.tsx:1096` +1 more |
| GET | `/api/authz/roles` | `modules/platform-admin/routes/authz/roles.ts:129` | `features/mission-control/engines/components/EngineMembersModal.tsx:384`, `features/platform-admin/hooks/useAuthzApi.ts:312`, `features/starbase/pages/ProjectDetail.tsx:932` |
| POST | `/api/authz/roles` | `modules/platform-admin/routes/authz/roles.ts:168` | `features/platform-admin/components/RoleLibrarySettingsTab.tsx:195`, `features/platform-admin/hooks/useAuthzApi.ts:338` |
| GET | `/api/authz/roles/:id` | `modules/platform-admin/routes/authz/roles.ts:156` | `features/platform-admin/hooks/useAuthzApi.ts:320`, `features/platform-admin/hooks/useAuthzApi.ts:329` |
| PUT | `/api/authz/roles/:id` | `modules/platform-admin/routes/authz/roles.ts:183` | `features/platform-admin/components/RoleLibrarySettingsTab.tsx:187`, `features/platform-admin/hooks/useAuthzApi.ts:346` |
| DELETE | `/api/authz/roles/:id` | `modules/platform-admin/routes/authz/roles.ts:198` | `features/platform-admin/components/RoleLibrarySettingsTab.tsx:205`, `features/platform-admin/hooks/useAuthzApi.ts:357` |
| GET | `/api/authz/runtime-resource-sets` | `modules/platform-admin/routes/authz/engine-sets.ts:120` | `features/platform-admin/hooks/useAuthzApi.ts:726` |
| POST | `/api/authz/runtime-resource-sets/:id/materialize` | `modules/platform-admin/routes/authz/engine-sets.ts:129` | `features/platform-admin/hooks/useAuthzApi.ts:734` |
| GET | `/api/authz/runtime-resources` | `modules/platform-admin/routes/authz/engine-sets.ts:111` | `features/platform-admin/hooks/useAuthzApi.ts:714`, `features/platform-admin/pages/AccessControl.tsx:908` |
| POST | `/api/authz/runtime-resources/:id/reconcile` | `modules/platform-admin/routes/authz/engine-sets.ts:133` | `features/platform-admin/hooks/useAuthzApi.ts:742` |
| GET | `/api/authz/service-accounts` | `modules/platform-admin/routes/authz/machines.ts:67` | `features/platform-admin/hooks/useAuthzApi.ts:530` |
| POST | `/api/authz/service-accounts` | `modules/platform-admin/routes/authz/machines.ts:77` | `features/platform-admin/hooks/useAuthzApi.ts:538` |
| DELETE | `/api/authz/service-accounts/:id` | `modules/platform-admin/routes/authz/machines.ts:103` | `features/platform-admin/hooks/useAuthzApi.ts:554` |
| POST | `/api/authz/service-accounts/:id/rotate` | `modules/platform-admin/routes/authz/machines.ts:93` | `features/platform-admin/hooks/useAuthzApi.ts:546` |
| GET | `/api/authz/sso-sync-runs` | `modules/platform-admin/routes/authz/sso-sync-diagnostics.ts:21` | `features/platform-admin/hooks/useAuthzApi.ts:908` |
| GET | `/api/authz/sso-sync-runs/:id/events` | `modules/platform-admin/routes/authz/sso-sync-diagnostics.ts:60` | `features/platform-admin/hooks/useAuthzApi.ts:920` |
| POST | `/api/authz/sso-sync-runs/reconcile` | `modules/platform-admin/routes/authz/sso-sync-diagnostics.ts:39` | `features/platform-admin/hooks/useAuthzApi.ts:929` |

## `/api/dashboard`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/dashboard/context` | `modules/dashboard/routes/context.ts:53` | `pages/Dashboard.tsx:222` |
| GET | `/api/dashboard/stats` | `modules/dashboard/routes/stats.ts:19` | `pages/Dashboard.tsx:240` |

## `/api/identity`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/identity/mappings` | `modules/platform-admin/routes/identity-mappings.ts:67` | `features/platform-admin/hooks/useAuthzApi.ts:950` |
| POST | `/api/identity/mappings` | `modules/platform-admin/routes/identity-mappings.ts:70` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:227` |
| PUT | `/api/identity/mappings/:id` | `modules/platform-admin/routes/identity-mappings.ts:162` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:226` |
| DELETE | `/api/identity/mappings/:id` | `modules/platform-admin/routes/identity-mappings.ts:168` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:268` |
| POST | `/api/identity/mappings/:id/access` | `modules/platform-admin/routes/identity-mappings.ts:118` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:279` |
| POST | `/api/identity/mappings/provision-access` | `modules/platform-admin/routes/identity-mappings.ts:75` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:223` |
| POST | `/api/identity/mappings/stored-snapshot-preview` | `modules/platform-admin/routes/identity-mappings.ts:178` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:308` |
| POST | `/api/identity/mappings/test` | `modules/platform-admin/routes/identity-mappings.ts:174` | `features/platform-admin/components/IdentityMappingsSettingsTab.tsx:292` |
| POST | `/api/identity/provider-secrets` | `modules/platform-admin/routes/identity-providers.ts:80` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:377` |
| POST | `/api/identity/provider-secrets/retire` | `modules/platform-admin/routes/identity-providers.ts:100` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:393` |
| GET | `/api/identity/providers` | `modules/platform-admin/routes/identity-providers.ts:76` | `features/platform-admin/hooks/useAuthzApi.ts:942` |
| POST | `/api/identity/providers` | `modules/platform-admin/routes/identity-providers.ts:244` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:390` |
| PUT | `/api/identity/providers/:key` | `modules/platform-admin/routes/identity-providers.ts:252` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:390` |
| DELETE | `/api/identity/providers/:key` | `modules/platform-admin/routes/identity-providers.ts:315` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:417` |
| POST | `/api/identity/providers/:key/external-identities/unlink` | `modules/platform-admin/routes/identity-providers.ts:188` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:423` |
| POST | `/api/identity/providers/:key/reconcile` | `modules/platform-admin/routes/identity-providers.ts:280` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:418` |
| POST | `/api/identity/providers/:key/reconciliation-preview` | `modules/platform-admin/routes/identity-providers.ts:289` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:419` |
| POST | `/api/identity/providers/:key/replay-memberships` | `modules/platform-admin/routes/identity-providers.ts:298` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:420` |
| PUT | `/api/identity/providers/:key/secrets/:purpose` | `modules/platform-admin/routes/identity-providers.ts:120` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:376` |
| GET | `/api/identity/providers/:key/sync-runs` | `modules/platform-admin/routes/identity-providers.ts:211` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:364` |
| POST | `/api/identity/providers/:key/test-connection` | `modules/platform-admin/routes/identity-providers.ts:227` | `features/platform-admin/components/IdentityProvidersSettingsTab.tsx:421` |
| GET | `/api/identity/provisioning-directories` | `modules/platform-admin/routes/identity-provisioning.ts:78` | `api/platform-admin/identityProvisioning.ts:18`, `pages/admin/UserManagement.tsx:360` |
| POST | `/api/identity/provisioning-directories` | `modules/platform-admin/routes/identity-provisioning.ts:94` | `api/platform-admin/identityProvisioning.ts:20` |
| PUT | `/api/identity/provisioning-directories/:key` | `modules/platform-admin/routes/identity-provisioning.ts:133` | `api/platform-admin/identityProvisioning.ts:22` |
| DELETE | `/api/identity/provisioning-directories/:key` | `modules/platform-admin/routes/identity-provisioning.ts:147` | `api/platform-admin/identityProvisioning.ts:23` |
| GET | `/api/identity/provisioning-directories/:key/credentials` | `modules/platform-admin/routes/identity-provisioning.ts:181` | `api/platform-admin/identityProvisioning.ts:25` |
| POST | `/api/identity/provisioning-directories/:key/credentials` | `modules/platform-admin/routes/identity-provisioning.ts:186` | `api/platform-admin/identityProvisioning.ts:27` |
| DELETE | `/api/identity/provisioning-directories/:key/credentials/:credentialId` | `modules/platform-admin/routes/identity-provisioning.ts:229` | `api/platform-admin/identityProvisioning.ts:31` |
| POST | `/api/identity/provisioning-directories/:key/credentials/:credentialId/rotate` | `modules/platform-admin/routes/identity-provisioning.ts:207` | `api/platform-admin/identityProvisioning.ts:29` |
| GET | `/api/identity/provisioning-directories/:key/events` | `modules/platform-admin/routes/identity-provisioning.ts:243` | `api/platform-admin/identityProvisioning.ts:32` |
| POST | `/api/identity/provisioning-directories/:key/test` | `modules/platform-admin/routes/identity-provisioning.ts:161` | `api/platform-admin/identityProvisioning.ts:24` |

## `/api/invitations`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/invitations/:token` | `modules/invitations/routes/invitations.ts:171` | `pages/AcceptInvite.tsx:129` |
| POST | `/api/invitations/:token/redeem` | `modules/invitations/routes/invitations.ts:252` | `pages/AcceptInvite.tsx:151` |
| POST | `/api/invitations/:token/verify-otp` | `modules/invitations/routes/invitations.ts:212` | `pages/AcceptInvite.tsx:172` |

## `/api/mission-control`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| POST | `/api/mission-control/bridge/starbase-edit/evaluate` | `modules/platform-admin/routes/authz/project-engine-targets.ts:51` | `features/platform-admin/hooks/useAuthzApi.ts:894`, `shared/api/bridgeAuthz.ts:20` |

## `/api/notifications`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/notifications` | `modules/notifications/routes/notifications.ts:51` | `features/shared/components/LayoutWithProSidebar.tsx:237` |
| POST | `/api/notifications` | `modules/notifications/routes/notifications.ts:118` | `shared/notifications/ToastProvider.tsx:70` |
| DELETE | `/api/notifications` | `modules/notifications/routes/notifications.ts:176` | `features/shared/components/LayoutWithProSidebar.tsx:258` |
| DELETE | `/api/notifications/:id` | `modules/notifications/routes/notifications.ts:196` | `features/shared/components/LayoutWithProSidebar.tsx:278` |
| PATCH | `/api/notifications/read` | `modules/notifications/routes/notifications.ts:149` | `features/shared/components/LayoutWithProSidebar.tsx:253` |

## `/api/platform`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/platform/tenants` | `modules/tenancy/routes/tenants.ts:463` | `features/platform-admin/pages/TenantsPage.tsx:30` |
| POST | `/api/platform/tenants` | `modules/tenancy/routes/tenants.ts:467` | `features/platform-admin/pages/TenantsPage.tsx:34` |

## `/api/plugin-platform`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/plugin-platform/v1/audit` | `plugins/pluginControlRoutes.ts:168` | `features/platform-admin/api/pluginPlatform.ts:180` |
| GET | `/api/plugin-platform/v1/capabilities` | `plugins/pluginControlRoutes.ts:116` | `features/platform-admin/api/pluginPlatform.ts:164` |
| GET | `/api/plugin-platform/v1/catalog` | `plugins/pluginManagerBrowserRoutes.ts:89` | `features/platform-admin/api/pluginPlatform.ts:214` |
| GET | `/api/plugin-platform/v1/deployment-execution` | `plugins/pluginControlRoutes.ts:141` | `features/platform-admin/api/pluginPlatform.ts:198` |
| GET | `/api/plugin-platform/v1/emergency-control` | `plugins/pluginControlRoutes.ts:133` | `features/platform-admin/api/pluginPlatform.ts:172` |
| PUT | `/api/plugin-platform/v1/emergency-control` | `plugins/pluginControlRoutes.ts:149` | `features/platform-admin/api/pluginPlatform.ts:301` |
| GET | `/api/plugin-platform/v1/events/dead-letters` | `plugins/pluginControlRoutes.ts:196` | `features/platform-admin/api/pluginPlatform.ts:190` |
| GET | `/api/plugin-platform/v1/installations` | `plugins/pluginManagerBrowserRoutes.ts:119` | `features/platform-admin/api/pluginPlatform.ts:225` |
| POST | `/api/plugin-platform/v1/installations` | `plugins/pluginManagerBrowserRoutes.ts:146` | `features/platform-admin/api/pluginPlatform.ts:253` |
| GET | `/api/plugin-platform/v1/installations/:installationId` | `plugins/pluginManagerBrowserRoutes.ts:133` | `features/platform-admin/api/pluginPlatform.ts:235` |
| POST | `/api/plugin-platform/v1/installations/:installationId/approval` | `plugins/pluginManagerBrowserRoutes.ts:171` | `features/platform-admin/api/pluginPlatform.ts:271` |
| GET | `/api/plugin-platform/v1/manager` | `plugins/pluginManagerBrowserRoutes.ts:101` | `features/platform-admin/api/pluginPlatform.ts:206` |
| GET | `/api/plugin-platform/v1/plugins` | `plugins/pluginControlRoutes.ts:125` | `features/platform-admin/api/pluginPlatform.ts:156` |
| POST | `/api/plugin-platform/v1/plugins/:pluginId/disable` | `plugins/pluginControlRoutes.ts:285` | `features/platform-admin/api/pluginPlatform.ts:328` |
| POST | `/api/plugin-platform/v1/plugins/:pluginId/enable` | `plugins/pluginControlRoutes.ts:236` | `features/platform-admin/api/pluginPlatform.ts:328` |
| POST | `/api/plugin-platform/v1/plugins/:pluginId/events/dead-letters/:deliveryId/requeue` | `plugins/pluginControlRoutes.ts:254` | `features/platform-admin/api/pluginPlatform.ts:343` |

## `/api/plugins`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/plugins/v1/:pluginId/operations/:operationId` | `plugins/pluginRuntime.ts:1913` | `plugins/nativePluginRuntime.tsx:275` |
| POST | `/api/plugins/v1/:pluginId/operations/:operationId` | `plugins/pluginRuntime.ts:1913` | `plugins/nativePluginRuntime.tsx:291`, `plugins/nativePluginRuntime.tsx:313` |
| PUT | `/api/plugins/v1/:pluginId/operations/:operationId` | `plugins/pluginRuntime.ts:1913` | `plugins/nativePluginRuntime.tsx:281` |
| PATCH | `/api/plugins/v1/:pluginId/operations/:operationId` | `plugins/pluginRuntime.ts:1913` | `plugins/nativePluginRuntime.tsx:283` |
| DELETE | `/api/plugins/v1/:pluginId/operations/:operationId` | `plugins/pluginRuntime.ts:1913` | `plugins/nativePluginRuntime.tsx:288` |

## `/api/starbase`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| POST | `/api/starbase/bridge/mission-control/evaluate` | `modules/platform-admin/routes/authz/project-engine-targets.ts:55` | `features/platform-admin/hooks/useAuthzApi.ts:901`, `shared/api/bridgeAuthz.ts:24` |

## `/api/t/:tenantSlug/apps`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/t/:tenantSlug/apps` | `plugins/pluginControlRoutes.ts:362` | `features/platform-admin/api/tenantApplications.ts:16` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/activate` | `plugins/pluginControlRoutes.ts:501` | `features/platform-admin/api/tenantApplications.ts:28` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/activation-request` | `plugins/pluginControlRoutes.ts:445` | `features/platform-admin/api/tenantApplications.ts:44` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/activation-request/decision` | `plugins/pluginControlRoutes.ts:464` | `features/platform-admin/api/tenantApplications.ts:61` |
| GET | `/api/t/:tenantSlug/apps/:pluginId/audit` | `plugins/pluginControlRoutes.ts:402` | `features/platform-admin/api/tenantApplications.ts:76` |
| POST | `/api/t/:tenantSlug/apps/:pluginId/deactivate` | `plugins/pluginControlRoutes.ts:506` | `features/platform-admin/api/tenantApplications.ts:28` |

## `/api/t/:tenantSlug/auth`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| POST | `/api/t/:tenantSlug/auth/complete-onboarding` | `modules/auth/routes/onboarding.ts:101` | `pages/AcceptInvite.tsx:202` |
| POST | `/api/t/:tenantSlug/auth/login` | `modules/auth/routes/login.ts:339` | `services/auth.ts:50` |
| GET | `/api/t/:tenantSlug/auth/login-methods` | `modules/auth/routes/identity-oidc.ts:554` | `pages/Login.tsx:179` |
| GET | `/api/t/:tenantSlug/auth/onboarding/login-methods` | `modules/auth/routes/identity-oidc.ts:547` | `pages/AcceptInvite.tsx:85` |
| POST | `/api/t/:tenantSlug/auth/onboarding/providers/:providerId/login` | `modules/auth/routes/identity-oidc.ts:549` | `pages/AcceptInvite.tsx:113` |
| GET (nav) | `/api/t/:tenantSlug/auth/onboarding/providers/:providerId/start` | `modules/auth/routes/identity-oidc.ts:548` | `pages/AcceptInvite.tsx:101` |
| POST | `/api/t/:tenantSlug/auth/providers/:providerId/login` | `modules/auth/routes/identity-oidc.ts:556` | `pages/Login.tsx:525` |
| GET (nav) | `/api/t/:tenantSlug/auth/providers/:providerId/start` | `modules/auth/routes/identity-oidc.ts:555` | `pages/Login.tsx:371` |

## `/api/t/:tenantSlug/invitations`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| POST | `/api/t/:tenantSlug/invitations` | `modules/invitations/routes/invitations.ts:100` | `components/InviteMemberModal.tsx:126` |
| GET | `/api/t/:tenantSlug/invitations/:token` | `modules/invitations/routes/invitations.ts:172` | `pages/AcceptInvite.tsx:129` |
| POST | `/api/t/:tenantSlug/invitations/:token/redeem` | `modules/invitations/routes/invitations.ts:253` | `pages/AcceptInvite.tsx:151` |
| POST | `/api/t/:tenantSlug/invitations/:token/verify-otp` | `modules/invitations/routes/invitations.ts:213` | `pages/AcceptInvite.tsx:172` |
| GET | `/api/t/:tenantSlug/invitations/capabilities` | `modules/invitations/routes/invitations.ts:90` | `components/InviteMemberModal.tsx:63`, `pages/admin/UserManagement.tsx:348`, `pages/admin/UserManagement.tsx:371` |

## `/api/t/:tenantSlug/tenant`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/t/:tenantSlug/tenant/discovery-domains` | `modules/tenancy/routes/tenants.ts:554` | `features/platform-admin/pages/TenantSettingsPage.tsx:72` |
| POST | `/api/t/:tenantSlug/tenant/discovery-domains` | `modules/tenancy/routes/tenants.ts:558` | `features/platform-admin/pages/TenantSettingsPage.tsx:104` |
| DELETE | `/api/t/:tenantSlug/tenant/discovery-domains/:domainId` | `modules/tenancy/routes/tenants.ts:579` | `features/platform-admin/pages/TenantSettingsPage.tsx:126` |
| POST | `/api/t/:tenantSlug/tenant/discovery-domains/:domainId/verify` | `modules/tenancy/routes/tenants.ts:571` | `features/platform-admin/pages/TenantSettingsPage.tsx:114` |
| GET | `/api/t/:tenantSlug/tenant/login-policy` | `modules/tenancy/routes/tenants.ts:517` | `features/platform-admin/pages/TenantSettingsPage.tsx:62` |
| PUT | `/api/t/:tenantSlug/tenant/login-policy` | `modules/tenancy/routes/tenants.ts:525` | `features/platform-admin/pages/TenantSettingsPage.tsx:78` |
| GET | `/api/t/:tenantSlug/tenant/members` | `modules/tenancy/routes/tenants.ts:584` | `features/platform-admin/pages/TenantSettingsPage.tsx:67` |
| PUT | `/api/t/:tenantSlug/tenant/members/:userId` | `modules/tenancy/routes/tenants.ts:588` | `features/platform-admin/pages/TenantSettingsPage.tsx:87` |
| DELETE | `/api/t/:tenantSlug/tenant/members/:userId` | `modules/tenancy/routes/tenants.ts:594` | `features/platform-admin/pages/TenantSettingsPage.tsx:96` |

## `/api/tenancy`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/tenancy/capabilities` | `modules/tenancy/routes/tenants.ts:135` | `services/tenancy.ts:30` |

## `/api/users`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/api/users` | `modules/users/routes/users.ts:28` | `api/platform-admin/admin.ts:79`, `pages/Dashboard.tsx:254`, `services/auth.ts:147` |
| POST | `/api/users` | `modules/users/routes/users.ts:39` | `services/auth.ts:154` |
| GET | `/api/users/:id` | `modules/users/routes/users.ts:124` | `services/auth.ts:161` |
| PUT | `/api/users/:id` | `modules/users/routes/users.ts:136` | `services/auth.ts:168` |
| DELETE | `/api/users/:id` | `modules/users/routes/users.ts:152` | `services/auth.ts:175` |
| GET | `/api/users/:id/audit` | `modules/users/routes/users.ts:101` | `api/platform-admin/userDirectory.ts:31` |
| POST | `/api/users/:id/deactivate` | `modules/users/routes/users.ts:105` | `api/platform-admin/userDirectory.ts:33` |
| GET | `/api/users/:id/effective-access` | `modules/users/routes/users.ts:93` | `api/platform-admin/userDirectory.ts:27` |
| GET | `/api/users/:id/identity-context` | `modules/users/routes/users.ts:89` | `api/platform-admin/userDirectory.ts:25` |
| DELETE | `/api/users/:id/permanent` | `modules/users/routes/users.ts:167` | `services/auth.ts:179` |
| POST | `/api/users/:id/reactivate` | `modules/users/routes/users.ts:111` | `api/platform-admin/userDirectory.ts:35` |
| POST | `/api/users/:id/revoke-sessions` | `modules/users/routes/users.ts:115` | `api/platform-admin/userDirectory.ts:37` |
| GET | `/api/users/:id/sessions` | `modules/users/routes/users.ts:97` | `api/platform-admin/userDirectory.ts:29` |
| POST | `/api/users/:id/unlock` | `modules/users/routes/users.ts:188` | `services/auth.ts:186` |
| GET | `/api/users/directory` | `modules/users/routes/users.ts:82` | `api/platform-admin/userDirectory.ts:23` |

## `/_enterpriseglue`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/_enterpriseglue/plugins/:pluginId/:version/*assetPath` | `plugins/pluginRuntime.ts:1850` | `plugins/nativePluginRuntime.tsx:496` |

## `/engines-api`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/engines-api/engines` | `modules/mission-control/engines/routes.ts:1145` | `features/mission-control/engines/api/engines.ts:118`, `features/mission-control/engines/api/engines.ts:131` |
| POST | `/engines-api/engines` | `modules/mission-control/engines/routes.ts:1177` | `features/mission-control/engines/api/engines.ts:143` |
| GET | `/engines-api/engines/:engineId/access-requests` | `modules/engines/routes/management.ts:883` | `features/mission-control/engines/api/engines.ts:252` |
| POST | `/engines-api/engines/:engineId/access-requests/:requestId/approve` | `modules/engines/routes/management.ts:909` | `features/mission-control/engines/api/engines.ts:317` |
| POST | `/engines-api/engines/:engineId/access-requests/:requestId/deny` | `modules/engines/routes/management.ts:937` | `features/mission-control/engines/api/engines.ts:325` |
| POST | `/engines-api/engines/:engineId/delegate` | `modules/engines/routes/management.ts:632` | `features/mission-control/engines/api/engines.ts:298` |
| GET | `/engines-api/engines/:engineId/deployment-history` | `modules/engines/routes/deployments.ts:825` | `features/mission-control/engines/api/engines.ts:374` |
| GET | `/engines-api/engines/:engineId/deployment-receipts` | `modules/engines/routes/deployments.ts:819` | `features/mission-control/engines/api/engines.ts:366` |
| POST | `/engines-api/engines/:engineId/deployments` | `modules/engines/routes/deployments.ts:763` | `features/mission-control/engines/api/engines.ts:358` |
| GET | `/engines-api/engines/:engineId/deployments/:deploymentId/lineage` | `modules/engines/routes/deployments.ts:853` | `features/mission-control/engines/api/engines.ts:382` |
| POST | `/engines-api/engines/:engineId/environment` | `modules/engines/routes/management.ts:720` | `features/mission-control/engines/api/engines.ts:159` |
| GET | `/engines-api/engines/:engineId/members` | `modules/engines/routes/management.ts:240` | `features/mission-control/engines/api/engines.ts:244` |
| POST | `/engines-api/engines/:engineId/members` | `modules/engines/routes/management.ts:338` | `features/mission-control/engines/api/engines.ts:336` |
| PATCH | `/engines-api/engines/:engineId/members/:userId` | `modules/engines/routes/management.ts:467` | `features/mission-control/engines/api/engines.ts:290` |
| DELETE | `/engines-api/engines/:engineId/members/:userId` | `modules/engines/routes/management.ts:507` | `features/mission-control/engines/api/engines.ts:279` |
| GET | `/engines-api/engines/:engineId/members/capabilities` | `modules/engines/routes/management.ts:260` | `features/mission-control/engines/api/engines.ts:260` |
| GET | `/engines-api/engines/:engineId/members/lookup` | `modules/engines/routes/management.ts:277` | `features/mission-control/engines/api/engines.ts:271` |
| POST | `/engines-api/engines/:engineId/pending-invites/:invitationId/reissue` | `modules/engines/routes/management.ts:544` | `features/mission-control/engines/api/engines.ts:309` |
| POST | `/engines-api/engines/:engineId/request-access` | `modules/engines/routes/management.ts:849` | `features/mission-control/engines/api/engines.ts:347` |
| PUT | `/engines-api/engines/:id` | `modules/mission-control/engines/routes.ts:2339` | `features/mission-control/engines/api/engines.ts:147` |
| DELETE | `/engines-api/engines/:id` | `modules/mission-control/engines/routes.ts:2468` | `features/mission-control/engines/api/engines.ts:155` |
| GET | `/engines-api/engines/:id/backstop/mappings` | `modules/mission-control/engines/routes.ts:1924` | `features/mission-control/engines/api/engines.ts:63` |
| POST | `/engines-api/engines/:id/backstop/mappings` | `modules/mission-control/engines/routes.ts:1931` | `features/mission-control/engines/api/engines.ts:70` |
| GET | `/engines-api/engines/:id/backstop/status` | `modules/mission-control/engines/routes.ts:1912` | `features/mission-control/engines/api/engines.ts:59` |
| GET | `/engines-api/engines/:id/backstop/sync` | `modules/mission-control/engines/routes.ts:1955` | `features/mission-control/engines/api/engines.ts:74` |
| POST | `/engines-api/engines/:id/backstop/sync/:runId/apply` | `modules/mission-control/engines/routes.ts:1977` | `features/mission-control/engines/api/engines.ts:86` |
| POST | `/engines-api/engines/:id/backstop/sync/:runId/drift-check` | `modules/mission-control/engines/routes.ts:1997` | `features/mission-control/engines/api/engines.ts:106` |
| POST | `/engines-api/engines/:id/backstop/sync/:runId/rollback` | `modules/mission-control/engines/routes.ts:1987` | `features/mission-control/engines/api/engines.ts:98` |
| POST | `/engines-api/engines/:id/backstop/sync/preview` | `modules/mission-control/engines/routes.ts:1940` | `features/mission-control/engines/api/engines.ts:78` |
| GET | `/engines-api/engines/:id/camunda-native-grants/imports` | `modules/mission-control/engines/routes.ts:1889` | `features/mission-control/engines/components/CamundaNativeGrantMigrationPanel.tsx:87` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/apply` | `modules/mission-control/engines/routes.ts:2059` | `features/mission-control/engines/components/CamundaNativeGrantMigrationPanel.tsx:135` |
| GET | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/detail` | `modules/mission-control/engines/routes.ts:1904` | `features/mission-control/engines/components/CamundaNativeGrantMigrationPanel.tsx:106` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/draft` | `modules/mission-control/engines/routes.ts:2007` | `features/mission-control/engines/components/CamundaNativeGrantMigrationPanel.tsx:118` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/rollback` | `modules/mission-control/engines/routes.ts:2154` | `features/mission-control/engines/components/CamundaNativeGrantMigrationPanel.tsx:158` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/:runId/rollback/preview` | `modules/mission-control/engines/routes.ts:2126` | `features/mission-control/engines/components/CamundaNativeGrantMigrationPanel.tsx:147` |
| POST | `/engines-api/engines/:id/camunda-native-grants/imports/preview` | `modules/mission-control/engines/routes.ts:1841` | `features/mission-control/engines/components/CamundaNativeGrantMigrationPanel.tsx:93` |
| GET | `/engines-api/engines/:id/health` | `modules/mission-control/engines/routes.ts:2540` | `features/mission-control/engines/api/engines.ts:236` |
| GET | `/engines-api/engines/:id/project-targets` | `modules/mission-control/engines/routes.ts:2196` | `features/mission-control/engines/api/engines.ts:228` |
| POST | `/engines-api/engines/:id/tenancy/apply` | `modules/mission-control/engines/routes.ts:2252` | `features/mission-control/engines/api/engines.ts:197` |
| GET | `/engines-api/engines/:id/tenancy/diagnostics` | `modules/mission-control/engines/routes.ts:2211` | `features/mission-control/engines/api/engines.ts:175` |
| POST | `/engines-api/engines/:id/tenancy/preview` | `modules/mission-control/engines/routes.ts:2215` | `features/mission-control/engines/api/engines.ts:186` |
| GET | `/engines-api/engines/:id/tenant-mappings` | `modules/mission-control/engines/routes.ts:2297` | `features/mission-control/engines/api/engines.ts:205` |
| PUT | `/engines-api/engines/:id/tenant-mappings` | `modules/mission-control/engines/routes.ts:2310` | `features/mission-control/engines/api/engines.ts:216` |
| POST | `/engines-api/engines/:id/test` | `modules/mission-control/engines/routes.ts:2523` | `features/mission-control/engines/api/engines.ts:167` |
| GET | `/engines-api/environment-tags` | `modules/engines/routes/management.ts:778` | `features/mission-control/engines/api/engines.ts:224` |
| GET | `/engines-api/saved-filters` | `modules/mission-control/engines/routes.ts:2593` | `features/mission-control/processes-overview/api/processDefinitions.ts:91` |
| POST | `/engines-api/saved-filters` | `modules/mission-control/engines/routes.ts:2605` | `features/mission-control/processes-overview/api/processDefinitions.ts:95` |
| DELETE | `/engines-api/saved-filters/:id` | `modules/mission-control/engines/routes.ts:2664` | `features/mission-control/processes-overview/api/processDefinitions.ts:99` |

## `/git-api`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/git-api/admin/providers` | `modules/git/routes/providers.ts:102` | `api/platform-admin/admin.ts:106` |
| PUT | `/git-api/admin/providers/:id` | `modules/git/routes/providers.ts:159` | `api/platform-admin/admin.ts:109` |
| POST | `/git-api/clone` | `modules/git/routes/clone.ts:117` | `features/git/api/gitApi.ts:116` |
| GET | `/git-api/commits` | `modules/git/routes/deployments.ts:238` | `features/git/api/gitApi.ts:169` |
| POST | `/git-api/create-online` | `modules/git/routes/createOnline.ts:54` | `features/git/hooks/useOnlineProjectWizard.ts:490` |
| GET | `/git-api/credentials` | `modules/git/routes/credentials.ts:68` | `features/git/hooks/useOnlineProjectWizard.ts:234`, `features/starbase/pages/ProjectOverview.tsx:272`, `pages/settings/GitConnections.tsx:105` |
| POST | `/git-api/credentials` | `modules/git/routes/credentials.ts:95` | `features/git/hooks/useOnlineProjectWizard.ts:390`, `pages/settings/GitConnections.tsx:159`, `pages/settings/GitConnections.tsx:184` |
| PATCH | `/git-api/credentials/:credentialId` | `modules/git/routes/credentials.ts:114` | `pages/settings/GitConnections.tsx:211` |
| GET | `/git-api/credentials/:credentialId/namespaces` | `modules/git/routes/credentials.ts:156` | `features/git/hooks/useOnlineProjectWizard.ts:265` |
| DELETE | `/git-api/credentials/:providerId` | `modules/git/routes/credentials.ts:132` | `pages/settings/GitConnections.tsx:117` |
| GET | `/git-api/credentials/:providerId/validate` | `modules/git/routes/credentials.ts:144` | `features/git/components/SyncModal.tsx:111` |
| POST | `/git-api/deploy` | `modules/git/routes/deployments.ts:34` | `features/git/api/gitApi.ts:146` |
| GET | `/git-api/deployments` | `modules/git/routes/deployments.ts:162` | `features/git/api/gitApi.ts:153` |
| GET | `/git-api/deployments/:id` | `modules/git/routes/deployments.ts:196` | `features/git/api/gitApi.ts:157` |
| GET | `/git-api/locks` | `modules/git/routes/locks.ts:142` | `features/git/api/gitApi.ts:187` |
| POST | `/git-api/locks` | `modules/git/routes/locks.ts:42` | `features/git/api/gitApi.ts:174` |
| DELETE | `/git-api/locks/:lockId` | `modules/git/routes/locks.ts:103` | `features/git/api/gitApi.ts:181` |
| PUT | `/git-api/locks/:lockId/heartbeat` | `modules/git/routes/locks.ts:162` | `features/git/api/gitApi.ts:191` |
| GET (nav) | `/git-api/oauth/:providerId/authorize/redirect` | `modules/git/routes/credentials.ts:197` | `features/git/hooks/useOnlineProjectWizard.ts:435`, `pages/settings/GitConnections.tsx:244` |
| POST | `/git-api/oauth/callback` | `modules/git/routes/credentials.ts:258` | `features/git/pages/OAuthCallback.tsx:39` |
| GET | `/git-api/project-connection` | `modules/git/routes/gitConnection.ts:47` | `features/git/components/ProjectGitSettings.tsx:109`, `features/starbase/pages/ProjectDetail.tsx:451` |
| POST | `/git-api/project-connection` | `modules/git/routes/gitConnection.ts:89` | `features/git/components/ProjectGitSettings.tsx:136` |
| DELETE | `/git-api/project-connection` | `modules/git/routes/gitConnection.ts:229` | `features/git/components/ProjectGitSettings.tsx:166` |
| PUT | `/git-api/project-connection/token` | `modules/git/routes/gitConnection.ts:172` | `features/git/components/ProjectGitSettings.tsx:151` |
| GET | `/git-api/providers` | `modules/git/routes/providers.ts:42` | `features/git/api/gitApi.ts:76`, `pages/settings/GitConnections.tsx:111` |
| GET | `/git-api/providers/:id/repos` | `modules/git/routes/providers.ts:190` | `features/git/api/gitApi.ts:104` |
| POST | `/git-api/repo-info` | `modules/git/routes/clone.ts:48` | `features/git/api/gitApi.ts:109` |
| GET | `/git-api/repositories` | `modules/git/routes/repositories.ts:61` | `features/git/api/gitApi.ts:81`, `features/git/api/gitApi.ts:130`, `features/git/components/SyncModal.tsx:101` +1 more |
| GET | `/git-api/repositories/:id` | `modules/git/routes/repositories.ts:111` | `features/git/api/gitApi.ts:85` |
| DELETE | `/git-api/repositories/:id` | `modules/git/routes/repositories.ts:149` | `features/git/api/gitApi.ts:123` |
| POST | `/git-api/repositories/clone` | `modules/git/routes/repositories.ts:47` | `features/git/api/gitApi.ts:96` |
| POST | `/git-api/repositories/init` | `modules/git/routes/repositories.ts:34` | `features/git/api/gitApi.ts:89` |
| POST | `/git-api/rollback` | `modules/git/routes/deployments.ts:222` | `features/git/api/gitApi.ts:161` |
| POST | `/git-api/sync` | `modules/git/routes/sync.ts:115` | `features/git/components/SyncModal.tsx:138`, `features/starbase/pages/ProjectOverview.tsx:383` |
| GET | `/git-api/sync/status` | `modules/git/routes/sync.ts:56` | `features/git/components/SyncModal.tsx:122` |

## `/mission-control-api`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| GET | `/mission-control-api/batches` | `modules/mission-control/batches/routes.ts:175` | `features/mission-control/batches/api/batches.ts:24`, `features/mission-control/batches/components/BatchesList.tsx:50` |
| GET | `/mission-control-api/batches/:id` | `modules/mission-control/batches/routes.ts:259` | `features/mission-control/batches/api/batches.ts:32`, `features/mission-control/batches/components/BatchDetailModal.tsx:43` |
| DELETE | `/mission-control-api/batches/:id` | `modules/mission-control/batches/routes.ts:444` | `features/mission-control/batches/api/batches.ts:49`, `features/mission-control/batches/components/BatchDetailModal.tsx:99`, `features/mission-control/batches/components/BatchesList.tsx:105` |
| DELETE | `/mission-control-api/batches/:id/record` | `modules/mission-control/batches/routes.ts:463` | `features/mission-control/batches/components/BatchesList.tsx:117` |
| PUT | `/mission-control-api/batches/:id/suspended` | `modules/mission-control/batches/routes.ts:215` | `features/mission-control/batches/api/batches.ts:53`, `features/mission-control/batches/api/batches.ts:57`, `features/mission-control/batches/components/BatchDetailModal.tsx:82` +1 more |
| POST | `/mission-control-api/batches/jobs/retries` | `modules/mission-control/batches/routes.ts:153` | `features/mission-control/batches/api/batches.ts:75`, `features/mission-control/batches/api/batches.ts:80` |
| POST | `/mission-control-api/batches/process-instances/activate` | `modules/mission-control/batches/routes.ts:145` | `features/mission-control/batches/api/batches.ts:71`, `features/mission-control/batches/api/batches.ts:99` |
| POST | `/mission-control-api/batches/process-instances/delete` | `modules/mission-control/batches/routes.ts:119` | `features/mission-control/batches/api/batches.ts:63`, `features/mission-control/batches/api/batches.ts:84` |
| POST | `/mission-control-api/batches/process-instances/suspend` | `modules/mission-control/batches/routes.ts:136` | `features/mission-control/batches/api/batches.ts:67`, `features/mission-control/batches/api/batches.ts:95` |
| GET | `/mission-control-api/decision-definitions` | `modules/mission-control/decisions/routes.ts:81` | `features/mission-control/decisions-overview/api/decisions.ts:21`, `features/shared/components/ProSidebar.tsx:253` |
| GET | `/mission-control-api/decision-definitions/:id` | `modules/mission-control/decisions/routes.ts:101` | `features/mission-control/decisions-overview/api/decisions.ts:25` |
| GET | `/mission-control-api/decision-definitions/:id/xml` | `modules/mission-control/decisions/routes.ts:109` | `features/mission-control/shared/api/definitions.ts:17` |
| GET | `/mission-control-api/decision-definitions/edit-target` | `modules/mission-control/decisions/routes.ts:41` | `features/mission-control/decision-instance-detail/components/DecisionHistoryDetail.tsx:225`, `features/mission-control/decisions-overview/components/Decisions.tsx:258` |
| POST | `/mission-control-api/decision-definitions/key/:key/evaluate` | `modules/mission-control/decisions/routes.ts:125` | `features/starbase/pages/Editor.tsx:1716` |
| GET | `/mission-control-api/history/decisions` | `modules/mission-control/shared/history-extended.ts:69` | `features/mission-control/decision-instance-detail/api/decisionInstances.ts:22`, `features/mission-control/decision-instance-detail/components/DecisionHistoryDetail.tsx:87`, `features/mission-control/decision-instance-detail/components/DecisionHistoryDetail.tsx:110` +3 more |
| GET | `/mission-control-api/history/decisions/:id/inputs` | `modules/mission-control/shared/history-extended.ts:86` | `features/mission-control/decision-instance-detail/api/decisionInstances.ts:23`, `features/mission-control/decision-instance-detail/components/DecisionHistoryDetail.tsx:141`, `features/mission-control/process-instance-detail/ProcessInstanceDetailPage.tsx:761` |
| GET | `/mission-control-api/history/decisions/:id/outputs` | `modules/mission-control/shared/history-extended.ts:99` | `features/mission-control/decision-instance-detail/api/decisionInstances.ts:24`, `features/mission-control/decision-instance-detail/components/DecisionHistoryDetail.tsx:155`, `features/mission-control/process-instance-detail/ProcessInstanceDetailPage.tsx:767` |
| GET | `/mission-control-api/history/process-instances/:id` | `modules/mission-control/shared/mission_control.ts:315` | `features/mission-control/process-instance-detail/api/processInstances.ts:90` |
| GET | `/mission-control-api/history/variable-instances` | `modules/mission-control/shared/mission_control.ts:378` | `features/mission-control/process-instance-detail/api/processInstances.ts:94` |
| POST | `/mission-control-api/migration/active-sources` | `modules/mission-control/migration/routes.ts:102` | `features/mission-control/migration-wizard/hooks/useMigrationData.ts:433` |
| POST | `/mission-control-api/migration/execute-async` | `modules/mission-control/migration/routes.ts:80` | `features/mission-control/migration-wizard/api/migration.ts:57`, `features/mission-control/migration-wizard/hooks/useMigrationData.ts:341` |
| POST | `/mission-control-api/migration/execute-direct` | `modules/mission-control/migration/routes.ts:91` | `features/mission-control/migration-wizard/api/migration.ts:52`, `features/mission-control/migration-wizard/hooks/useMigrationData.ts:381` |
| POST | `/mission-control-api/migration/generate` | `modules/mission-control/migration/routes.ts:65` | `features/mission-control/migration-wizard/api/migration.ts:34`, `features/mission-control/migration-wizard/hooks/useMigrationData.ts:177` |
| POST | `/mission-control-api/migration/plan/validate` | `modules/mission-control/migration/routes.ts:69` | `features/mission-control/migration-wizard/api/migration.ts:47`, `features/mission-control/migration-wizard/hooks/useMigrationData.ts:280` |
| POST | `/mission-control-api/migration/preview` | `modules/mission-control/migration/routes.ts:35` | `features/mission-control/migration-wizard/hooks/useMigrationData.ts:257` |
| GET | `/mission-control-api/process-definitions` | `modules/mission-control/shared/mission_control.ts:96` | `features/mission-control/migration-wizard/hooks/useMigrationData.ts:52`, `features/mission-control/process-instance-detail/api/processInstances.ts:100`, `features/mission-control/processes-overview/api/processDefinitions.ts:36` +1 more |
| GET | `/mission-control-api/process-definitions/:id/active-activity-counts` | `modules/mission-control/shared/mission_control.ts:165` | `features/mission-control/processes-overview/api/processDefinitions.ts:41` |
| GET | `/mission-control-api/process-definitions/:id/activity-counts-by-state` | `modules/mission-control/shared/mission_control.ts:178` | `features/mission-control/processes-overview/api/processDefinitions.ts:46` |
| GET | `/mission-control-api/process-definitions/:id/xml` | `modules/mission-control/shared/mission_control.ts:153` | `features/mission-control/shared/api/definitions.ts:7` |
| GET | `/mission-control-api/process-definitions/edit-target` | `modules/mission-control/processes/routes.ts:85` | `features/mission-control/process-instance-detail/ProcessInstanceDetailPage.tsx:884`, `features/mission-control/processes-overview/ProcessesOverviewPage.tsx:656` |
| POST | `/mission-control-api/process-definitions/key/:key/start` | `modules/mission-control/processes/routes.ts:152` | `features/mission-control/processes-overview/ProcessesOverviewPage.tsx:1116` |
| GET | `/mission-control-api/process-instances` | `modules/mission-control/shared/mission_control.ts:209` | `features/mission-control/processes-overview/api/processDefinitions.ts:83`, `pages/Dashboard.tsx:261` |
| GET | `/mission-control-api/process-instances/:id` | `modules/mission-control/shared/mission_control.ts:240` | `features/mission-control/process-instance-detail/api/processInstances.ts:32` |
| DELETE | `/mission-control-api/process-instances/:id` | `modules/mission-control/shared/mission_control.ts:429` | `features/mission-control/process-instance-detail/ProcessInstanceDetailPage.tsx:1348`, `features/mission-control/processes-overview/ProcessesOverviewPage.tsx:1691` |
| PUT | `/mission-control-api/process-instances/:id/activate` | `modules/mission-control/shared/mission_control.ts:418` | `features/mission-control/process-instance-detail/ProcessInstanceDetailPage.tsx:1164`, `features/mission-control/processes-overview/ProcessesOverviewPage.tsx:1574` |
| GET | `/mission-control-api/process-instances/:id/activity-instances` | `modules/mission-control/process-instances/routes.ts:100` | `features/mission-control/process-instance-detail/api/processInstances.ts:56` |
| GET | `/mission-control-api/process-instances/:id/execution-details` | `modules/mission-control/shared/mission_control.ts:285` | `features/mission-control/process-instance-detail/api/processInstances.ts:73` |
| GET | `/mission-control-api/process-instances/:id/failed-external-tasks` | `modules/mission-control/shared/mission_control.ts:442` | `features/mission-control/process-instance-detail/api/processInstances.ts:85`, `features/mission-control/processes-overview/api/processDefinitions.ts:120` |
| GET | `/mission-control-api/process-instances/:id/history/activity-instances` | `modules/mission-control/shared/mission_control.ts:273` | `features/mission-control/process-instance-detail/api/processInstances.ts:52`, `features/mission-control/processes-overview/api/processDefinitions.ts:110` |
| GET | `/mission-control-api/process-instances/:id/incidents` | `modules/mission-control/shared/mission_control.ts:365` | `features/mission-control/process-instance-detail/api/processInstances.ts:77`, `features/mission-control/processes-overview/ProcessesOverviewPage.tsx:1058` |
| GET | `/mission-control-api/process-instances/:id/jobs` | `modules/mission-control/shared/mission_control.ts:302` | `features/mission-control/process-instance-detail/api/processInstances.ts:81`, `features/mission-control/processes-overview/api/processDefinitions.ts:115` |
| POST | `/mission-control-api/process-instances/:id/modify` | `modules/mission-control/shared/modify.ts:38` | `features/mission-control/process-instance-detail/components/hooks/useInstanceModification.ts:219` |
| POST | `/mission-control-api/process-instances/:id/retry` | `modules/mission-control/shared/mission_control.ts:454` | `features/mission-control/process-instance-detail/api/processInstances.ts:44`, `features/mission-control/processes-overview/ProcessesOverviewPage.tsx:1052`, `features/mission-control/processes-overview/components/modals/RetryModal.tsx:110` |
| PUT | `/mission-control-api/process-instances/:id/suspend` | `modules/mission-control/shared/mission_control.ts:407` | `features/mission-control/process-instance-detail/ProcessInstanceDetailPage.tsx:1160`, `features/mission-control/processes-overview/ProcessesOverviewPage.tsx:1579` |
| GET | `/mission-control-api/process-instances/:id/variable-history` | `modules/mission-control/shared/mission_control.ts:352` | `features/mission-control/process-instance-detail/api/processInstances.ts:48` |
| GET | `/mission-control-api/process-instances/:id/variables` | `modules/mission-control/shared/mission_control.ts:261` | `features/mission-control/process-instance-detail/api/processInstances.ts:36`, `features/mission-control/processes-overview/api/processDefinitions.ts:105` |
| POST | `/mission-control-api/process-instances/:id/variables` | `modules/mission-control/process-instances/routes.ts:121` | `features/mission-control/process-instance-detail/api/processInstances.ts:40` |
| POST | `/mission-control-api/process-instances/preview-count` | `modules/mission-control/shared/mission_control.ts:192` | `features/mission-control/processes-overview/api/processDefinitions.ts:87` |

## `/starbase-api`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| DELETE | `/starbase-api/deployments/:id` | `modules/starbase/routes/deployments.ts:38` | `features/git/components/GitVersionsPanel.tsx:555` |
| GET | `/starbase-api/files/:fileId` | `modules/starbase/routes/files.ts:250` | `api/starbase/files.ts:15`, `features/shared/components/Breadcrumbs.tsx:57`, `features/shared/components/FileMenu.tsx:36` +4 more |
| PUT | `/starbase-api/files/:fileId` | `modules/starbase/routes/files.ts:375` | `api/starbase/files.ts:21`, `features/starbase/pages/Editor.tsx:2045` |
| PATCH | `/starbase-api/files/:fileId` | `modules/starbase/routes/files.ts:580` | `api/starbase/files.ts:24`, `features/shared/components/Breadcrumbs.tsx:135`, `features/starbase/hooks/useInlineRename.ts:55` |
| DELETE | `/starbase-api/files/:fileId` | `modules/starbase/routes/files.ts:665` | `api/starbase/files.ts:29` |
| GET | `/starbase-api/files/:fileId/comments` | `modules/starbase/routes/comments.ts:20` | `features/starbase/components/CommentsPanel.tsx:15` |
| GET | `/starbase-api/files/:fileId/download` | `modules/starbase/routes/files.ts:353` | `features/starbase/pages/ProjectDetail.tsx:607`, `features/starbase/pages/ProjectDetail.tsx:621` |
| POST | `/starbase-api/files/:fileId/restore-from-commit` | `modules/starbase/routes/files.ts:458` | `features/starbase/pages/Editor.tsx:2279` |
| GET | `/starbase-api/files/:fileId/versions` | `modules/starbase/routes/versions.ts:55` | `features/git/components/GitVersionsPanel.tsx:355`, `features/starbase/components/VersionsPanel.tsx:15` |
| POST | `/starbase-api/files/:fileId/versions` | `modules/starbase/routes/versions.ts:99` | `features/git/components/GitVersionsPanel.tsx:459`, `features/starbase/components/CommitModal.tsx:60` |
| GET | `/starbase-api/files/:fileId/versions/:versionId` | `modules/starbase/routes/versions.ts:135` | `features/git/components/GitVersionsPanel.tsx:428` |
| POST | `/starbase-api/files/:fileId/versions/:versionId/restore` | `modules/starbase/routes/versions.ts:160` | `features/git/components/GitVersionsPanel.tsx:510` |
| PATCH | `/starbase-api/folders/:folderId` | `modules/starbase/routes/folders.ts:446` | `api/starbase/folders.ts:22`, `features/starbase/hooks/useInlineRename.ts:55` |
| DELETE | `/starbase-api/folders/:folderId` | `modules/starbase/routes/folders.ts:551` | `api/starbase/folders.ts:28` |
| GET | `/starbase-api/folders/:folderId/delete-preview` | `modules/starbase/routes/folders.ts:503` | `api/starbase/folders.ts:25` |
| GET | `/starbase-api/folders/:folderId/download` | `modules/starbase/routes/folders.ts:582` | `features/starbase/pages/ProjectDetail.tsx:646` |
| GET | `/starbase-api/projects` | `modules/starbase/routes/projects.ts:187` | `api/starbase/projects.ts:22`, `features/shared/components/Breadcrumbs.tsx:63`, `features/starbase/pages/ProjectDetail.tsx:362` +2 more |
| POST | `/starbase-api/projects` | `modules/starbase/routes/projects.ts:372` | `api/starbase/projects.ts:80`, `features/git/hooks/useOnlineProjectWizard.ts:517` |
| PATCH | `/starbase-api/projects/:projectId` | `modules/starbase/routes/projects.ts:474` | `api/starbase/projects.ts:83`, `features/starbase/hooks/useInlineRename.ts:55` |
| DELETE | `/starbase-api/projects/:projectId` | `modules/starbase/routes/projects.ts:491` | `api/starbase/projects.ts:85`, `features/starbase/pages/ProjectOverview.tsx:418`, `features/starbase/pages/ProjectOverview.tsx:769` |
| GET | `/starbase-api/projects/:projectId/contents` | `modules/starbase/routes/folders.ts:326` | `api/starbase/projects.ts:27`, `features/shared/components/Breadcrumbs.tsx:72`, `features/shared/components/Breadcrumbs.tsx:82` +1 more |
| GET | `/starbase-api/projects/:projectId/deployment-targets` | `modules/starbase/routes/projects.ts:506` | `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:170` |
| POST | `/starbase-api/projects/:projectId/deployment-targets` | `modules/starbase/routes/projects.ts:524` | `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:196`, `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:198` |
| PUT | `/starbase-api/projects/:projectId/deployment-targets/:targetId` | `modules/starbase/routes/projects.ts:540` | `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:212` |
| DELETE | `/starbase-api/projects/:projectId/deployment-targets/:targetId` | `modules/starbase/routes/projects.ts:555` | `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:222` |
| POST | `/starbase-api/projects/:projectId/deployment-targets/sync-legacy` | `modules/starbase/routes/projects.ts:516` | `features/starbase/components/project-detail/ProjectDeploymentTargetsModal.tsx:231` |
| GET | `/starbase-api/projects/:projectId/download` | `modules/starbase/routes/folders.ts:644` | `features/starbase/pages/ProjectDetail.tsx:659`, `features/starbase/pages/ProjectOverview.tsx:724` |
| POST | `/starbase-api/projects/:projectId/download-selection` | `modules/starbase/routes/folders.ts:714` | `features/starbase/pages/ProjectDetail.tsx:726` |
| GET | `/starbase-api/projects/:projectId/engine-access` | `modules/starbase/routes/projects.ts:570` | `api/starbase/projects.ts:33` |
| GET | `/starbase-api/projects/:projectId/engine-deployments/latest` | `modules/starbase/routes/engine-deployments.ts:51` | `features/starbase/pages/Editor.tsx:1592` |
| GET | `/starbase-api/projects/:projectId/files` | `modules/starbase/routes/files.ts:135` | `api/starbase/files.ts:13`, `features/starbase/pages/Editor.tsx:253`, `features/starbase/pages/StarbaseHome.tsx:25` |
| POST | `/starbase-api/projects/:projectId/files` | `modules/starbase/routes/files.ts:170` | `api/starbase/files.ts:18`, `features/starbase/pages/Editor.tsx:1110`, `features/starbase/pages/Editor.tsx:2157` +1 more |
| GET | `/starbase-api/projects/:projectId/files/:fileId/callers` | `modules/starbase/routes/files.ts:294` | `features/starbase/pages/Editor.tsx:263` |
| GET | `/starbase-api/projects/:projectId/files/:fileId/deployments/history` | `modules/starbase/routes/engine-deployments.ts:40` | `features/git/components/GitVersionsPanel.tsx:408` |
| GET | `/starbase-api/projects/:projectId/folders` | `modules/starbase/routes/folders.ts:384` | `api/starbase/folders.ts:16`, `features/starbase/components/project-detail/FolderTreeHelpers.tsx:25` |
| POST | `/starbase-api/projects/:projectId/folders` | `modules/starbase/routes/folders.ts:402` | `api/starbase/folders.ts:19` |
| POST | `/starbase-api/projects/:projectId/import-zip` | `modules/starbase/routes/folders.ts:690` | `features/starbase/pages/ProjectDetail.tsx:679` |
| GET | `/starbase-api/projects/:projectId/members` | `modules/starbase/routes/members.ts:446` | `api/starbase/projects.ts:36` |
| POST | `/starbase-api/projects/:projectId/members` | `modules/starbase/routes/members.ts:590` | `api/starbase/projects.ts:75` |
| PATCH | `/starbase-api/projects/:projectId/members/:userId` | `modules/starbase/routes/members.ts:734` | `api/starbase/projects.ts:78` |
| DELETE | `/starbase-api/projects/:projectId/members/:userId` | `modules/starbase/routes/members.ts:795` | `api/starbase/projects.ts:63` |
| PUT | `/starbase-api/projects/:projectId/members/:userId/deploy-permission` | `modules/starbase/routes/members.ts:373` | `api/starbase/projects.ts:51` |
| GET | `/starbase-api/projects/:projectId/members/capabilities` | `modules/starbase/routes/members.ts:351` | `api/starbase/projects.ts:42` |
| GET | `/starbase-api/projects/:projectId/members/lookup` | `modules/starbase/routes/members.ts:295` | `api/starbase/projects.ts:45` |
| GET | `/starbase-api/projects/:projectId/members/me` | `modules/starbase/routes/members.ts:893` | `api/starbase/projects.ts:39` |
| GET | `/starbase-api/projects/:projectId/members/user-search` | `modules/starbase/routes/members.ts:246` | `api/starbase/projects.ts:69` |
| POST | `/starbase-api/projects/:projectId/pending-invites/:invitationId/reissue` | `modules/starbase/routes/members.ts:503` | `api/starbase/projects.ts:57` |
| POST | `/starbase-api/projects/:projectId/transfer-ownership` | `modules/starbase/routes/members.ts:852` | `api/starbase/projects.ts:66` |
| POST | `/starbase-api/projects/import-preview` | `modules/starbase/routes/projects.ts:460` | `features/git/hooks/useOnlineProjectWizard.ts:335` |

## `/vcs-api`

| Method | Path | Backend route | Frontend callers |
|---|---|---|---|
| POST | `/vcs-api/projects/:projectId/commit` | `modules/versioning/index.ts:92` | `features/git/components/DeployDialog.tsx:150`, `features/git/components/GitVersionsPanel.tsx:473`, `features/starbase/components/CommitModal.tsx:73` |
| GET | `/vcs-api/projects/:projectId/commits` | `modules/versioning/index.ts:211` | `features/git/components/GitVersionsPanel.tsx:379`, `features/starbase/pages/Editor.tsx:1478` |
| GET | `/vcs-api/projects/:projectId/commits/:commitId/files` | `modules/versioning/index.ts:563` | `features/git/components/GitVersionsPanel.tsx:441` |
| POST | `/vcs-api/projects/:projectId/commits/:commitId/restore` | `modules/versioning/index.ts:585` | `features/git/components/GitVersionsPanel.tsx:512` |
| POST | `/vcs-api/projects/:projectId/publish` | `modules/versioning/index.ts:179` | `features/starbase/components/PublishModal.tsx:36` |
| GET | `/vcs-api/projects/:projectId/uncommitted-files` | `modules/versioning/index.ts:520` | `features/starbase/pages/Editor.tsx:1451`, `features/starbase/pages/ProjectDetail.tsx:422` |
| GET | `/vcs-api/projects/uncommitted-status` | `modules/versioning/index.ts:43` | `features/starbase/pages/ProjectOverview.tsx:254` |
