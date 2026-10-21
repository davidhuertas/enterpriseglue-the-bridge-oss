# Oracle Migration Portability Analysis

**Subject:** `ORA-00902: invalid datatype` during database initialization
**Observed on:** `enterpriseglue-*-backend-oracle` v0.31.1 (Oracle thick-client configuration)
**Date:** 2026-10-15
**Verdict:** Code defect in the legacy migration epoch. **Not** a deployment or `.env` misconfiguration.

---

## 1. Summary

Migration `AddRbacFoundation1700000000016` fails on Oracle because it builds `CREATE TABLE`
DDL from hardcoded PostgreSQL-flavoured column types (`text`, `bigint`) instead of the
dialect-aware helpers that already exist in the codebase.

The failure is not universal — it only manifests when the historical migration epoch is
actually *replayed*, which depends on the state of the target schema at startup. Section 3
explains that mechanism, which is the reason Oracle appears to work in some environments
and not others.

---

## 2. The failing statement

```sql
CREATE TABLE "sso_assignment_mappings" (
  "id" text NOT NULL,
  "provider_id" text,
  ...
  "priority" integer DEFAULT 0 NOT NULL,
  "is_active" number(1,0) DEFAULT 1 NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "PK_25ca41a86bbd38830df17c3ee3e" PRIMARY KEY ("id")
)
```

Reported error metadata:

```
errorNum: 902
offset: 45
code: 'ORA-00902'
```

Offset 45 lands exactly on the `text` token following `"id"` — the first Oracle-invalid
datatype in the statement.

### 2.1 The Oracle dialect was correctly detected

This is the single most important observation for ruling out a configuration problem.

The column `"is_active" number(1,0)` is **valid Oracle syntax**. It was produced by
`legacyBooleanColumn()` in
`packages/shared/src/db/migrations/support/portable-columns.ts`, which branches on:

```ts
const oracle = migrationDatabase(queryRunner) === 'oracle';
```

Combined with the stack frames showing `OracleQueryRunner` and
`typeorm/driver/oracle/OracleQueryRunner.js`, this proves the Oracle driver was selected
and the runtime knows it is talking to Oracle. The surrounding columns are simply
hardcoded and never consulted the dialect.

No SQLite is involved anywhere. `text` / `bigint` are PostgreSQL spellings baked into the
migration source.

---

## 3. Why this fires for some Oracle deployments and not others

The decisive logic is in `packages/shared/src/db/run-migrations.ts` (~lines 759–791):

```ts
if (missingTables.length > 0) {
  console.log('  ℹ️  Database bootstrap required ... Running TypeORM synchronize().');
  await dataSource.synchronize();
  if (!hadCanonicalTableBeforeBootstrap) {
    // A fully empty database was created directly from the current entity model.
    await recordFreshMigrationBaseline(dataSource, queryRunner, dbType);
    initializedFreshSchema = true;
  }
}
```

With `hadCanonicalTableBeforeBootstrap` computed as:

```ts
let hadCanonicalTableBeforeBootstrap =
  missingTables.length < coreBootstrapEntities.length;
if (!hadCanonicalTableBeforeBootstrap && dataSource.entityMetadatas?.length) {
  // ...then scan every other entity metadata for an existing table
}
```

### Path A — completely empty schema (works)

All 10 core bootstrap entities missing **and** no other canonical table present.

1. `synchronize()` creates the whole schema from **entity metadata**, which the TypeORM
   Oracle driver types correctly (`varchar2`, `number`, etc.).
2. `recordFreshMigrationBaseline()` stamps the entire historical ledger as applied.
3. The broken legacy migrations **never execute**.

This is why Oracle support appears functional.

### Path B — partially populated schema (fails)

At least one core table missing, but some canonical table already exists.

1. `hadCanonicalTableBeforeBootstrap` is `true`.
2. The baseline is **skipped**.
3. TypeORM replays the historical epoch against the existing schema.
4. Execution reaches migration 016 and hits the hardcoded types.

**The reported failure is Path B.**

---

## 4. Why it died specifically on `sso_assignment_mappings`

Migration 016 resolves table names through this helper:

```ts
function tablePath(queryRunner: QueryRunner, metadataName: string, fallback: string): string {
  try {
    return queryRunner.connection.getMetadata(metadataName).tablePath;
  } catch {
    return fallback;
  }
}
```

A repository-wide search for `SsoAssignmentMapping` returns matches in **migration files
only** — 016, 017, 021, 039 and 043. There is no entity class.

The consequences compound:

1. `getMetadata('SsoAssignmentMapping')` always throws, so the literal fallback
   `'sso_assignment_mappings'` is used.
2. Because there is no entity, `synchronize()` never creates this table — not even on
   Path A.
3. Therefore `createTableIfMissing()` **always** attempts the `CREATE TABLE`.
4. That DDL is assembled from hardcoded `text` / `bigint` → `ORA-00902`.

### Why migrations 001–015 passed first

Those migrations target **entity-backed** tables. On Path B those tables already existed,
so `createTableIfMissing()` / `addColumnIfMissing()` short-circuited before emitting any
DDL — despite containing the same unsafe hardcoded types.

`sso_assignment_mappings` is simply the first *orphaned* (non-entity-backed) table in
migration order. It is a latent landmine for every database, and Oracle is where it
detonates.

---

## 5. Which datatypes are actually invalid on Oracle

| Type in migrations | Oracle validity | Notes |
| --- | --- | --- |
| `text` | **Invalid** | No such datatype. Primary offender. |
| `bigint` | **Invalid** | No such datatype. |
| `boolean` | **Conditional** | Valid only on Oracle 23ai+. `portable-columns.ts` explicitly references "pre-23 Oracle booleans". |
| `integer` | **Valid** | ANSI type, maps to `NUMBER(38)`. Not a problem. |

Note that `"priority" integer DEFAULT 0 NOT NULL` in the failing statement was never a
defect — only `text` and `bigint` need remediation, plus `boolean` depending on the target
Oracle version.

---

## 6. Inventory of Oracle-unsafe migrations

Scanned directory: `packages/shared/src/db/migrations/`
Detection: literal occurrences of `type: 'text'`, `type: 'bigint'`, `type: 'boolean'`.

### Band 000–034

Offending files: **000, 001, 002, 003, 005, 009, 010, 011, 012, 013, 014, 015, 016, 017,
018, 019, 020, 021, 022, 023, 024, 025, 026, 027, 028, 029, 030, 031, 032, 033, 034**

| Migration | `text` | `bigint` |
| --- | --- | --- |
| 016 `add-rbac-foundation` | 41 | 11 |
| 025 `add-engine-sets` | 21 | 6 |
| 030 `add-external-engine-systems` | 16 | 2 |
| 023 `add-authz-groups` | 15 | 5 |
| 011 `add-invitations` | 15 | 7 |
| 012 `repair-invitations-legacy-schema` | 14 | 7 |
| 013 `cleanup-legacy-invitations-schema` | 14 | 7 |

### Band 037–058

Offending files: **037, 038, 039, 042, 044, 045, 046, 047, 048, 049, 050, 051, 052, 053,
054, 055, 056, 057, 058**

| Migration | `text` | `bigint` |
| --- | --- | --- |
| 037 `add-sso-sync-diagnostics` | 22 | 3 |
| 055 `add-runtime-resource-inventory` | 21 | 6 |
| 042 `add-sso-engine-access-snapshots-and-access-authority` | 17 | 5 |
| 038 `add-sso-normalized-identities` | 16 | 4 |
| 054 `add-runtime-resource-sets` | 13 | 2 |
| 057 `add-identity-reconciliation-and-deployment-receipts` | 13 | 4 |

### Band 061–091

Offending files: **061, 062, 063, 064, 066, 067, 068, 069, 070, 071, 074, 077, 078, 079,
080, 084, 085, 086, 088, 091**

### Band 112–123 — plugin platform (worst cluster, zero Oracle guards)

Offending files: **112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123**

| Migration | `text` | `bigint` | `boolean` |
| --- | --- | --- | --- |
| 123 `add-plugin-manager` | 44 | 17 | 1 |
| 114 `add-plugin-platform` | 41 | 16 | 6 |
| 118 `add-plugin-notifications-and-schedules` | 28 | 7 | 0 |
| 117 `add-plugin-events` | 19 | 7 | 1 |
| 120 `add-plugin-gateway-admission` | 12 | 7 | 0 |
| 116 `add-plugin-storage` | 8 | 4 | 0 |
| 122 `add-plugin-contribution-availability` | 8 | 8 | 0 |
| 119 `add-plugin-emergency-control` | 5 | 4 | 2 |
| 115 `add-plugin-broker-replay` | 5 | 2 | 0 |
| 121 `add-plugin-event-circuit` | 3 | 1 | 0 |
| 112 `add-federated-session-lineage` | 3 | 0 | 0 |

### Already Oracle-aware

- **096–103** — each defines its own *local* dialect helpers, e.g.
  `if (database === 'oracle') return { type: 'varchar2', length: '4000' };`
- **059, 060, 075, 076, 087** — contain Oracle or portable-helper guards.
- **079** — partially guarded; still contains unguarded offending types.
- `oracle/1700000000134-expand-oracle-assignment-keys.ts` — Oracle-only by design.

---

## 7. Architectural observation

`packages/shared/src/db/migrations/support/portable-columns.ts` already provides exactly
the abstractions needed:

```ts
export function portableText(queryRunner, size)    // oracle → varchar2 / clob
export function portableBigint(queryRunner)        // oracle → number(19,0)
export function portableInteger(queryRunner)       // oracle → number(10,0)
export function portableBoolean(queryRunner)       // oracle → number(1,0)
```

Two inconsistencies undermine them:

1. **Under-adoption.** Across roughly 90 legacy migrations the module is used almost
   exclusively for booleans, via `legacyBooleanColumn()`. `portableText()` and
   `portableBigint()` are barely wired in — which is precisely why migration 016 produced
   a correct `number(1,0)` next to a dozen broken `text` columns.
2. **Duplication.** Migrations 096–103 reimplemented local copies of the same Oracle
   branches instead of importing the shared helpers, so the fix has drifted rather than
   propagated.

---

## 8. Configuration assessment

**No `.env` change resolves this.**

- `DATABASE_TYPE=oracle` is already taking full effect (see §2.1).
- There is no SQLite-to-Oracle switch to flip; the offending types are compile-time
  literals in migration source.
- No environment variable alters the DDL emitted by `createTableIfMissing()`.

The only non-code lever is **schema state, not configuration**: starting against a
genuinely empty Oracle schema routes initialization down Path A (§3), where the broken
epoch is skipped entirely.

---

## 9. Options

| Option | Applicability | Assessment |
| --- | --- | --- |
| Recreate the Oracle schema empty | Non-production / disposable data | Fastest route to a working stack. Takes Path A. Also worth establishing what left the schema partially populated. |
| Pre-create orphaned tables manually with correct Oracle types (`varchar2`, `number(19,0)`) | Any | `createTableIfMissing()` will then skip them — but must be repeated for every affected table across ~90 migrations. Fragile. |
| Convert migrations to the portable helpers | Any | The actual fix. Must cover the full inventory in §6, not migration 016 alone. |
| Pin to an image predating these migrations | If such a tag exists | Avoidance only. |

Fixing migration 016 in isolation does **not** resolve the problem — it advances the
failure to the next orphaned table in the inventory.

---

## 10. Reproduction conditions

1. Oracle target (thick client), `DATABASE_TYPE=oracle`.
2. A schema that is **not** empty: at least one canonical table present while one or more
   of the 10 core bootstrap entities are absent.
3. Start the backend so `runDatabaseInitialization()` executes in `apply` mode.
4. Initialization takes Path B, replays the historical epoch and aborts at
   `AddRbacFoundation1700000000016` with `ORA-00902`.

---

## Appendix — evidence trail

| Claim | Source |
| --- | --- |
| Oracle dialect correctly detected | `"is_active" number(1,0)` in the failing DDL; `legacyBooleanColumn()` in `support/portable-columns.ts`; `OracleQueryRunner` stack frames |
| Error located on first `text` token | `offset: 45` in the driver error payload |
| Baseline-vs-replay branch | `run-migrations.ts` ~lines 759–791 |
| `SsoAssignmentMapping` has no entity | Repository search returns migration files only (016, 017, 021, 039, 043) |
| Migration inventory and type counts | Literal scans for `type: 'text'`, `type: 'bigint'`, `type: 'boolean'` across `packages/shared/src/db/migrations/` |
