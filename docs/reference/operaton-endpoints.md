# Operaton REST Endpoints Consumed

Summary: The complete set of engine REST endpoints EnterpriseGlue calls against an Operaton
(or Camunda 7 compatible) engine, and what each one is used for.

Audience: Developers and architects.

## Scope

EnterpriseGlue does not treat Operaton as a distinct protocol. `getEngineCapabilities()` in
`packages/shared/src/services/bpmn-engine-capabilities.ts` declares three engine types — `ion`
(certified), `operaton` and `camunda7` (both compatible) — all sharing the
`camunda7-rest` compatibility profile. Every call listed here is issued against the engine's
configured `baseUrl`, typically `http://<host>:8080/engine-rest`, using the Camunda 7 REST
dialect that Operaton implements.

Use this page to size an Operaton deployment, scope the credentials handed to EnterpriseGlue,
or work out what a restricted or proxied engine would break.

Paths are relative to the engine `baseUrl`. `{id}` is an engine-side identifier.

## Engine and health

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/version` | Connection test from the Engines page, background health polling, and version display on the engine record. |

## Process definitions

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/process-definition` | List and filter definitions by `key`, `nameLike`, `latestVersion` or `version`. Also backs "import from engine" into Starbase. |
| GET | `/process-definition/{id}` | Single definition metadata. |
| GET | `/process-definition/{id}/xml` | BPMN XML for the diagram viewer and for Starbase import. |
| GET | `/process-definition/{id}/diagram` | Rendered diagram resource. |
| GET | `/process-definition/{id}/statistics?incidents=true` | Per-activity instance and incident counts used for diagram heatmap overlays. |
| POST | `/process-definition/key/{key}/start` | Start a new process instance from Mission Control. |
| POST | `/process-definition/{id}/modification/executeAsync` | Batch modification across many instances of a definition. |
| POST | `/process-definition/{id}/restart/executeAsync` | Batch restart of finished instances. |

## Process instances (runtime)

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/process-instance` | List runtime instances filtered by active, suspended, `withIncident`, activity, or parent instance. |
| GET | `/process-instance/{id}` | Single instance detail. |
| GET | `/process-instance/count` | Instance counts. |
| POST | `/process-instance/count` | Pre-flight "how many instances will this affect?" preview before a bulk operation. |
| GET | `/process-instance/{id}/activity-instances` | Live activity instance tree — active tokens and the suspended-state overlay. |
| GET | `/process-instance/{id}/variables` | Read runtime process variables for the variables panel. |
| POST | `/process-instance/{id}/variables` | Modify runtime process variables from the variable editor. |
| PUT | `/process-instance/{id}/suspended` | Suspend or activate a single instance. |
| DELETE | `/process-instance/{id}` | Cancel an instance. Sends `skipCustomListeners`, `skipIoMappings`, `skipSubprocesses`, `failIfNotExists` and `deleteReason` as query parameters. |
| POST | `/process-instance/{id}/modification` | Synchronous single-instance modification (cancel or start an activity). |
| POST | `/process-instance/delete` | Asynchronous bulk cancellation. Returns a batch. |
| POST | `/process-instance/suspended-async` | Asynchronous bulk suspend/activate. Returns a batch. |

## History

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/history/process-instance` | Completed and canceled instances. Also backfills start times and parent instance ids onto runtime rows. |
| GET | `/history/process-instance/{id}` | Historic instance detail. |
| GET | `/history/activity-instance` | Activity history — active, canceled and completed counts per activity, and the paged audit trail for one instance. |
| GET | `/history/task` | Historic user tasks, including the per-activity-instance execution details panel. |
| GET | `/history/variable-instance` | Process variable snapshot and the per-activity variable list. |
| GET | `/history/variable-instance/{id}` | Single variable snapshot, used as a fallback when no update details exist. |
| GET | `/history/detail?variableUpdates=true` | Variable change history (revisions over time). |
| GET | `/history/decision-instance` | Historic DMN evaluations. |
| GET | `/history/decision-instance/{id}?includeInputs&includeOutputs` | One evaluation with its inputs and outputs embedded. |
| GET | `/history/user-operation` | User operation log shown in execution details. |

## Tasks (user tasks)

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/task` | Task list. |
| GET | `/task/count` | Task count. |
| GET | `/task/{id}` | Task detail. |
| POST | `/task/{id}/claim` | Claim a task. |
| POST | `/task/{id}/unclaim` | Release a claimed task. |
| POST | `/task/{id}/assignee` | Reassign a task. |
| POST | `/task/{id}/complete` | Complete a task with variables. |
| GET | `/task/{id}/variables` | Read task-scoped variables. |
| POST | `/task/{id}/variables` | Modify task-scoped variables. |
| GET | `/task/{id}/form` | Task form key / embedded form reference. |

## External tasks

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/external-task` | List external tasks. Used to surface failed ones (no retries left plus an error message) for an instance. |
| POST | `/external-task/fetchAndLock` | Fetch and lock work items. |
| POST | `/external-task/{id}/complete` | Report successful completion. |
| POST | `/external-task/{id}/failure` | Report a technical failure. |
| POST | `/external-task/{id}/bpmnError` | Raise a BPMN error. |
| POST | `/external-task/{id}/extendLock` | Extend an existing lock. |
| POST | `/external-task/{id}/unlock` | Release a lock. |
| PUT | `/external-task/{id}/retries` | Reset retries — the external-task half of "retry failures". |

## Jobs and job definitions

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/job` | Jobs for an instance or job definition. Uses `withException=true` to isolate failed jobs. |
| GET | `/job/{id}` | Job detail. |
| GET | `/job/{id}/stacktrace` | Failure stacktrace shown in the batch and incident drilldown. |
| POST | `/job/{id}/execute` | Execute a job immediately. |
| PUT | `/job/{id}/retries` | Reset retries on a single job. |
| PUT | `/job/{id}/duedate` | Reschedule a job. |
| PUT | `/job/{id}/suspended` | Suspend or activate a job. |
| POST | `/job/retries-async` | Asynchronous bulk retry. Returns a batch. |
| GET | `/job-definition` | List job definitions, used when inspecting batch seed and execution jobs. |
| PUT | `/job-definition/{id}/retries` | Set retries for all jobs of a definition. |
| PUT | `/job-definition/{id}/suspended` | Suspend or activate a job definition. |

## Incidents

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/incident` | Incidents for an instance. Also flags `hasIncident` on instance lists, and decides whether a "retry failures" action targets jobs (`failedJob`) or external tasks (`failedExternalTask`). |

## Batches

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/batch` | List running batches. |
| GET | `/batch/{id}` | Batch detail. |
| GET | `/batch/{id}/statistics` | Progress — remaining, completed and failed jobs. Polled by the batch poller. |
| PUT | `/batch/{id}/suspended` | Suspend or resume a batch. |
| DELETE | `/batch/{id}` | Delete a batch. |

## Migration

| Method | Path | Used for |
| --- | --- | --- |
| POST | `/migration/generate` | Generate a source-to-target migration plan. |
| POST | `/migration/validate` | Validate a plan; returns per-instruction reports. |
| POST | `/migration/execute` | Synchronous migration of a small instance set. |
| POST | `/migration/executeAsync` | Asynchronous migration. Returns a batch. |

## Decisions (DMN)

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/decision-definition` | List decision definitions. Also backs Starbase import with `latestVersion=true`. |
| GET | `/decision-definition/{id}` | Definition detail. |
| GET | `/decision-definition/{id}/xml` | DMN XML for the viewer and for import. |
| POST | `/decision-definition/{id}/evaluate` | Evaluate a specific definition version. |
| POST | `/decision-definition/key/{key}/evaluate` | Evaluate the latest version by key. |

## Deployments

| Method | Path | Used for |
| --- | --- | --- |
| POST | `/deployment/create` | Multipart upload of BPMN, DMN and form resources. This is the deploy path. |
| GET | `/deployment` | List deployments. |
| GET | `/deployment/{id}` | Deployment detail. |
| DELETE | `/deployment/{id}?cascade=true` | Delete a deployment, optionally cascading to instances. |

## Messages and signals

| Method | Path | Used for |
| --- | --- | --- |
| POST | `/message` | Correlate a BPMN message to waiting instances. |
| POST | `/signal` | Broadcast a BPMN signal. |

## Metrics

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/metrics` | Engine metrics list. |
| GET | `/metrics/{name}` | A single named metric (for example flow node instances) over an interval. |

## How calls are made

Almost all traffic funnels through the shared client
`packages/shared/src/services/bpmn-engine-client.ts` (`camundaGet`, `camundaPost`, `camundaPut`,
`camundaDelete`), which resolves the engine row, decrypts stored credentials and applies auth:

- `none`
- `basic` — username and password
- `bearer` — a static token
- `oauth2-client-credentials` — token fetched from the configured token URL with optional scope
  and audience, cached in-process until 30 seconds before expiry

Every request also carries correlation headers: `X-EnterpriseGlue-Request-Id`,
`X-EnterpriseGlue-User-Id`, `X-EnterpriseGlue-Tenant-Id`, `X-EnterpriseGlue-Tenant-Slug`,
`X-EnterpriseGlue-Engine-Id`, plus an `X-EnterpriseGlue-Operation-Class` inferred from the method
and path (`engine.read`, `engine.deploy`, `engine.task.mutate`, `engine.job.mutate`,
`engine.batch.admin`, `engine.instance.mutate`, `engine.admin`). These map to the capability list
in `bpmn-engine-capabilities.ts` and let an engine-side gateway classify traffic.

Two calls bypass the shared client and use `fetch` directly, because they are not JSON:

- `POST /deployment/create` — multipart form upload, in `engines/routes/deployments.ts`
- `GET /version` — the connectivity probe, in `mission-control/engines/routes.ts`

## Where these calls originate

| Area | Source |
| --- | --- |
| Shared client and typed helpers | `packages/shared/src/services/bpmn-engine-client.ts` |
| Bulk of Mission Control reads and aggregations | `packages/backend-host/src/modules/mission-control/shared/mission-control-service.ts` |
| Feature services | `packages/backend-host/src/modules/mission-control/{processes,process-instances,decisions,migration,batches}/service.ts` |
| Action services | `packages/backend-host/src/modules/mission-control/shared/{direct,jobs,tasks,external-tasks,history-extended,messages,metrics,modify}-service.ts` |
| Deploy and deployment CRUD | `packages/backend-host/src/modules/engines/routes/deployments.ts` |
| Engine connectivity and health | `packages/backend-host/src/modules/mission-control/engines/routes.ts` |
| Import definitions back into Starbase | `packages/shared/src/services/starbase/engine-import-service.ts` |
| Batch progress polling | `packages/backend-host/src/poller/batchPoller.ts` |

## Related

- [Integration Architecture](../architecture/06-oss-integration-architecture.md)
- [Configuration Reference](configuration.md)
