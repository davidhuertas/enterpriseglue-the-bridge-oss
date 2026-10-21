/**
 * Turns the internal OpenAPI contract produced by generateOpenApi() into the documents published at
 * /api/docs and under docs/reference/openapi.
 *
 * The internal contract stays as it is because the authz route inventory and the schema contract tests
 * read it: every schema inline and the x-enterpriseglue-authz* metadata on every operation. The published
 * documents instead reference components, carry tags, operationIds and security, drop the internal
 * metadata, and can be split into one document per API area.
 */

type JsonObject = Record<string, any>;

export interface OpenApiDocumentDefinition {
  id: string;
  title: string;
  description: string;
  pathPatterns: RegExp[];
}

/** One published document per API area, matched by path. The first matching definition wins. */
export const OPENAPI_DOCUMENTS: readonly OpenApiDocumentDefinition[] = [
  {
    id: 'auth',
    title: 'Auth & Health',
    description: 'Login, sessions, onboarding, invitations, tenant discovery and the health, readiness and metrics probes.',
    pathPatterns: [/^\/(health|ready|metrics)$/, /^\/api\/(auth|invitations)(\/|$)/, /^\/api\/t\/[^/]+\/(auth|invitations)(\/|$)/],
  },
  {
    id: 'identity-access',
    title: 'Identity & Access',
    description: 'Identity providers, provisioning directories, identity mappings, users, roles, groups, policies, permissions and API clients.',
    pathPatterns: [/^\/api\/(identity|users)(\/|$)/, /^\/api\/t\/[^/]+\/identity(\/|$)/, /^\/api\/authz(\/|$)(?!config-bundles)/],
  },
  {
    id: 'config-bundles',
    title: 'Config Bundles',
    description: 'Headless configuration bundles: import, preview, diff, apply, export and governance ownership.',
    pathPatterns: [/^\/api\/authz\/config-bundles(\/|$)/],
  },
  {
    id: 'platform',
    title: 'Platform & Tenancy',
    description: 'Platform administration, settings, email, branding, audit, tenants, workloads, releases, plugins and tenant applications.',
    pathPatterns: [
      /^\/api\/(admin|audit|platform|notifications|dashboard|workloads|tenancy|plugin-platform)(\/|$)/,
      /^\/api\/t\/[^/]+\/(tenant|apps|plugin-platform)(\/|$)/,
    ],
  },
  {
    id: 'starbase',
    title: 'Starbase & Git',
    description: 'Design-time projects, folders, files, versions, comments, deployments and Git/VCS synchronisation.',
    pathPatterns: [/^\/(starbase|git|vcs)-api(\/|$)/, /^\/api\/starbase(\/|$)/],
  },
  {
    id: 'engines',
    title: 'Engines',
    description: 'Engine registry, engine tenancy, external engines, project-engine targets, backstop and saved filters.',
    pathPatterns: [/^\/engines-api(\/|$)/],
  },
  {
    id: 'mission-control',
    title: 'Mission Control',
    description: 'Runtime operations against the process engine: definitions, instances, tasks, jobs, batches, migration and history.',
    pathPatterns: [/^\/mission-control-api(\/|$)/, /^\/api\/mission-control(\/|$)/],
  },
  {
    id: 'scim',
    title: 'SCIM',
    description: 'SCIM 2.0 provisioning endpoints for external identity providers, authenticated with directory credentials.',
    pathPatterns: [/^\/scim(\/|$)/],
  },
];

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
const INTERNAL_EXTENSION_PREFIX = 'x-enterpriseglue-';
const AUTHZ_EXEMPTION_KEY = 'x-enterpriseglue-authz-exemption';
const LEGACY_TENANT_PREFIX = /^\/t\/(\{[^}]+\})\/api\//;

export const SESSION_SECURITY_SCHEMES: JsonObject = {
  BearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Access token returned by the login endpoints, sent as `Authorization: Bearer <token>`.',
  },
  CookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'accessToken',
    description: 'Access token cookie set by the browser login flows. Mutating requests also need the XSRF header.',
  },
};
const SESSION_SECURITY = [{ BearerAuth: [] }, { CookieAuth: [] }];

export interface PublishOpenApiOptions {
  /** Restrict the document to one entry of OPENAPI_DOCUMENTS. Omit for the combined document. */
  documentId?: string;
  servers?: Array<{ url: string; description?: string }>;
}

export function getOpenApiDocumentDefinition(documentId: string): OpenApiDocumentDefinition | undefined {
  return OPENAPI_DOCUMENTS.find((definition) => definition.id === documentId);
}

export function findOpenApiDocumentForPath(path: string): OpenApiDocumentDefinition | undefined {
  return OPENAPI_DOCUMENTS.find((definition) => definition.pathPatterns.some((pattern) => pattern.test(path)));
}

export function buildPublishedOpenApi(source: JsonObject, options: PublishOpenApiOptions = {}): JsonObject {
  const definition = options.documentId ? getOpenApiDocumentDefinition(options.documentId) : undefined;
  if (options.documentId && !definition) throw new Error(`Unknown OpenAPI document: ${options.documentId}`);

  const document = structuredClone(source) as JsonObject;
  stripInternalExtensions(document);
  const exemptions = collectPublicOperations(source);
  const schemas: JsonObject = document.components?.schemas ?? {};

  dropLegacyTenantAliases(document);
  hoistInlineComponents(document, schemas);

  const usedOperationIds = new Set<string>();
  const paths: JsonObject = {};
  for (const [path, pathItem] of Object.entries<JsonObject>(document.paths ?? {})) {
    const area = findOpenApiDocumentForPath(path);
    if (definition && area !== definition) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const { operationId, tags, summary, description, security, ...rest } = operation;
      pathItem[method] = {
        operationId: operationId ?? uniqueOperationId(method, path, usedOperationIds),
        tags: tags ?? [area?.title ?? 'Other'],
        ...(summary ? { summary } : {}),
        ...(description ? { description } : {}),
        ...rest,
        security: security ?? (exemptions.has(`${method} ${path}`) ? [] : SESSION_SECURITY),
      };
    }
    paths[path] = pathItem;
  }
  document.paths = paths;

  const securitySchemes = { ...SESSION_SECURITY_SCHEMES, ...document.components?.securitySchemes };
  document.components = {
    ...document.components,
    schemas: pickReferencedSchemas(paths, schemas),
    securitySchemes: pickReferencedSecuritySchemes(paths, securitySchemes),
  };

  document.info = {
    ...document.info,
    title: definition ? `EnterpriseGlue ${definition.title} API` : 'EnterpriseGlue API',
    description: [
      definition?.description ?? 'All EnterpriseGlue backend APIs. Each area is also published as its own document.',
      'Tenant-scoped routes under `/api/t/{tenantSlug}/...` are also served at the legacy alias `/t/{tenantSlug}/api/...`; only the first form is documented.',
    ].join('\n\n'),
  };
  document.servers = options.servers ?? [{ url: '/', description: 'This EnterpriseGlue deployment' }];
  document.tags = (definition ? [definition] : OPENAPI_DOCUMENTS)
    .filter((area) => Object.values(paths).some((item) => HTTP_METHODS.some((method) => item[method]?.tags?.includes(area.title))))
    .map((area) => ({ name: area.title, description: area.description }));

  return orderDocument(document);
}

/** Removes the x-enterpriseglue-* authorization metadata that operations carry for internal tooling. */
function stripInternalExtensions(document: JsonObject): void {
  for (const pathItem of Object.values<JsonObject>(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      for (const key of Object.keys(operation)) {
        if (key.startsWith(INTERNAL_EXTENSION_PREFIX)) delete operation[key];
      }
    }
  }
}

function collectPublicOperations(source: JsonObject): Set<string> {
  const publicOperations = new Set<string>();
  for (const [path, pathItem] of Object.entries<JsonObject>(source.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      if (pathItem[method]?.[AUTHZ_EXEMPTION_KEY]?.kind === 'public') publicOperations.add(`${method} ${path}`);
    }
  }
  return publicOperations;
}

/** `/t/{tenantSlug}/api/x` is an alias of `/api/t/{tenantSlug}/x`; keep the canonical path only. */
function dropLegacyTenantAliases(document: JsonObject): void {
  for (const path of Object.keys(document.paths ?? {})) {
    if (!LEGACY_TENANT_PREFIX.test(path)) continue;
    const canonical = path.replace(LEGACY_TENANT_PREFIX, '/api/t/$1/');
    if (document.paths[canonical]) delete document.paths[path];
  }
}

/**
 * zod-to-openapi renders registered schemas inline wherever the route passes the original zod instance.
 * Replace every inline copy of a component with a $ref, including copies nested in other components.
 */
function hoistInlineComponents(document: JsonObject, schemas: JsonObject): void {
  const componentByShape = new Map<string, string>();
  for (const [name, schema] of Object.entries(schemas)) {
    const shape = canonicalJson(schema);
    if (!componentByShape.has(shape)) componentByShape.set(shape, name);
  }

  const replace = (value: unknown, self?: string): unknown => {
    if (Array.isArray(value)) return value.map((item) => replace(item));
    if (!value || typeof value !== 'object') return value;
    const name = componentByShape.get(canonicalJson(value));
    if (name && name !== self) return { $ref: `#/components/schemas/${name}` };
    const result: JsonObject = {};
    for (const [key, child] of Object.entries(value)) result[key] = replace(child);
    return result;
  };

  document.paths = replace(document.paths);
  for (const name of Object.keys(schemas)) schemas[name] = replace(schemas[name], name);
}

function pickReferencedSchemas(paths: JsonObject, schemas: JsonObject): JsonObject {
  const used = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    const ref = (value as JsonObject).$ref;
    if (typeof ref === 'string' && ref.startsWith('#/components/schemas/')) {
      const name = ref.slice('#/components/schemas/'.length);
      if (!used.has(name)) {
        used.add(name);
        visit(schemas[name]);
      }
    }
    Object.values(value).forEach(visit);
  };
  visit(paths);
  return Object.fromEntries(Object.keys(schemas).sort().filter((name) => used.has(name)).map((name) => [name, schemas[name]]));
}

function pickReferencedSecuritySchemes(paths: JsonObject, securitySchemes: JsonObject): JsonObject {
  const used = new Set<string>();
  for (const pathItem of Object.values<JsonObject>(paths)) {
    for (const method of HTTP_METHODS) {
      for (const requirement of pathItem[method]?.security ?? []) Object.keys(requirement).forEach((name) => used.add(name));
    }
  }
  return Object.fromEntries(Object.entries(securitySchemes).filter(([name]) => used.has(name)));
}

/** GET /api/authz/roles/{id} -> getAuthzRolesById, POST /mission-control-api/tasks/{id}/claim -> postMissionControlTasksByIdClaim */
function uniqueOperationId(method: string, path: string, used: Set<string>): string {
  const words = path
    .replace(/^\/api\//, '/')
    .replace(/-api(\/|$)/, '$1')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const parameter = /^\{(.+)\}$/.exec(segment);
      return parameter ? `By-${parameter[1]}` : segment;
    })
    .join('-')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const base = [method, ...words].map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1))).join('');
  let candidate = base;
  for (let suffix = 2; used.has(candidate); suffix += 1) candidate = `${base}${suffix}`;
  used.add(candidate);
  return candidate;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as JsonObject)[key])}`).join(',')}}`;
}

function orderDocument(document: JsonObject): JsonObject {
  const { openapi, info, servers, tags, paths, components, ...rest } = document;
  return { openapi, info, servers, tags, paths, components, ...rest };
}
