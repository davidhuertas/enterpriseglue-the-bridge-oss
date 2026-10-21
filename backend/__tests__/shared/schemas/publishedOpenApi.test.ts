import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { generateOpenApi } from '@enterpriseglue/shared/schemas/openapi.js';
import { buildPublishedOpenApi, OPENAPI_DOCUMENTS } from '@enterpriseglue/shared/schemas/openapi-publish.js';
import { registerFinalMiddleware } from '../../../../packages/backend-host/src/app.js';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'];
const source = generateOpenApi();

function operations(document: any): Array<{ path: string; method: string; operation: any }> {
  return Object.entries<any>(document.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => item[method]).map((method) => ({ path, method, operation: item[method] })));
}

describe('published OpenAPI documents', () => {
  const combined = buildPublishedOpenApi(source);

  it('references registered components instead of inlining copies', () => {
    const response = combined.paths['/api/authz/config-bundles/preview'].post.requestBody.content['application/json'].schema;
    expect(response).toEqual({ $ref: '#/components/schemas/ConfigBundleRequest' });
    expect(JSON.stringify(combined).length).toBeLessThan(JSON.stringify(source).length * 0.7);
  });

  it('drops internal authorization metadata without touching the internal contract', () => {
    expect(JSON.stringify(combined)).not.toContain('x-enterpriseglue-');
    expect(source.paths['/starbase-api/projects'].get['x-enterpriseglue-authz']).toBeDefined();
  });

  it('documents tenant routes once, under the canonical /api/t prefix', () => {
    expect(combined.paths['/api/t/{tenantSlug}/identity/providers']).toBeDefined();
    expect(Object.keys(combined.paths).filter((path) => path.startsWith('/t/'))).toEqual([]);
  });

  it('gives every operation a unique operationId, an area tag and a security requirement', () => {
    const ids = operations(combined).map(({ operation }) => operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { operation } of operations(combined)) {
      expect(OPENAPI_DOCUMENTS.map((definition) => definition.title)).toContain(operation.tags[0]);
      expect(Array.isArray(operation.security)).toBe(true);
    }
    expect(combined.paths['/api/auth/login'].post.security).toEqual([]);
    expect(combined.paths['/starbase-api/projects'].get.security).toEqual([{ BearerAuth: [] }, { CookieAuth: [] }]);
    expect(combined.paths['/scim/v2/{directoryKey}/Users'].get.security).toEqual([{ ScimBearer: [] }]);
  });

  it('splits every operation into exactly one area document with only the schemas it uses', () => {
    const areaOperations = OPENAPI_DOCUMENTS.flatMap((definition) => {
      const document = buildPublishedOpenApi(source, { documentId: definition.id });
      const refs = [...JSON.stringify(document).matchAll(/#\/components\/schemas\/([^"]+)/g)].map((match) => match[1]);
      for (const ref of refs) expect(document.components.schemas[ref]).toBeDefined();
      expect(document.info.title).toBe(`EnterpriseGlue ${definition.title} API`);
      return operations(document).map(({ path, method }) => `${method} ${path}`);
    });
    expect(areaOperations.sort()).toEqual(operations(combined).map(({ path, method }) => `${method} ${path}`).sort());
  }, 30_000);

  it('serves each document as JSON next to Swagger UI', async () => {
    const app = express();
    registerFinalMiddleware(app);

    const all = await request(app).get('/api/docs/openapi.json');
    expect(all.status).toBe(200);
    expect(all.body.info.title).toBe('EnterpriseGlue API');

    const engines = await request(app).get('/api/docs/engines.json');
    expect(engines.status).toBe(200);
    expect(Object.keys(engines.body.paths).every((path) => path.startsWith('/engines-api'))).toBe(true);

    expect((await request(app).get('/api/docs/unknown.json')).type).not.toBe('application/json');

    const init = await request(app).get('/api/docs/swagger-ui-init.js');
    expect(init.text).toContain('/api/docs/mission-control.json');
  }, 30_000);
});
