#!/usr/bin/env node
// Writes the published OpenAPI documents to docs/reference/openapi, one per API area plus the combined
// document. With --check it regenerates them in memory, fails when the committed files drift, and lints
// every document (strict YAML, resolvable $refs, unique operationIds, tags and security on every operation).
//
// Requires a built shared package: pnpm --filter ./packages/shared run build

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { generateOpenApi } from '../packages/shared/dist/schemas/openapi.js';
import { buildPublishedOpenApi, OPENAPI_DOCUMENTS } from '../packages/shared/dist/schemas/openapi-publish.js';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const outputDir = path.join(process.cwd(), 'docs', 'reference', 'openapi');
const check = process.argv.includes('--check');

const source = generateOpenApi();
const documents = [
  { id: 'openapi', title: 'All APIs', document: buildPublishedOpenApi(source) },
  ...OPENAPI_DOCUMENTS.map((definition) => ({
    id: definition.id,
    title: definition.title,
    document: buildPublishedOpenApi(source, { documentId: definition.id }),
  })),
];

const files = new Map();
for (const { id, document } of documents) {
  files.set(`${id}.yaml`, YAML.stringify(document, { indent: 2, lineWidth: 0, aliasDuplicateObjects: false }));
}
files.set('README.md', renderIndex(documents));

const problems = documents.flatMap(({ id, document }) => lint(`${id}.yaml`, document, files.get(`${id}.yaml`)));
problems.push(...checkCoverage(documents));

if (check) {
  for (const [name, content] of files) {
    const filePath = path.join(outputDir, name);
    const committed = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (committed !== content) problems.push(`${path.relative(process.cwd(), filePath)} is out of date; run pnpm run docs:openapi`);
  }
} else {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, content] of files) fs.writeFileSync(path.join(outputDir, name), content);
}

if (problems.length > 0) {
  console.error('[openapi-docs] Failed:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`[openapi-docs] ${check ? 'Up to date' : 'Wrote'}: ${[...files.keys()].join(', ')}`);

function operationsOf(document) {
  return Object.entries(document.paths).flatMap(([route, pathItem]) =>
    HTTP_METHODS.filter((method) => pathItem[method]).map((method) => ({ route, method, operation: pathItem[method] })));
}

function lint(name, document, yamlText) {
  const problems = [];
  const reparsed = YAML.parse(yamlText, { strict: true, uniqueKeys: true, prettyErrors: true });
  if (JSON.stringify(reparsed) !== JSON.stringify(document)) problems.push(`${name}: YAML does not round-trip`);

  const json = JSON.stringify(document);
  if (json.includes('"x-enterpriseglue-')) problems.push(`${name}: contains internal x-enterpriseglue-* metadata`);
  for (const [, ref] of json.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)) {
    if (!document.components?.schemas?.[ref]) problems.push(`${name}: unresolved $ref ${ref}`);
  }

  const operationIds = new Set();
  for (const { route, method, operation } of operationsOf(document)) {
    const label = `${name}: ${method.toUpperCase()} ${route}`;
    if (!operation.operationId) problems.push(`${label} has no operationId`);
    else if (operationIds.has(operation.operationId)) problems.push(`${label} repeats operationId ${operation.operationId}`);
    operationIds.add(operation.operationId);
    if (!operation.tags?.length || operation.tags.includes('Other')) problems.push(`${label} is not assigned to an API area`);
    if (!Array.isArray(operation.security)) problems.push(`${label} declares no security`);
    for (const requirement of operation.security ?? []) {
      for (const scheme of Object.keys(requirement)) {
        if (!document.components?.securitySchemes?.[scheme]) problems.push(`${label} uses undeclared security scheme ${scheme}`);
      }
    }
  }
  return problems;
}

/** Every operation of the combined document belongs to exactly one area document. */
function checkCoverage(allDocuments) {
  const [combined, ...areas] = allDocuments;
  const owners = new Map();
  for (const { id, document } of areas) {
    for (const { route, method } of operationsOf(document)) {
      const key = `${method.toUpperCase()} ${route}`;
      owners.set(key, [...(owners.get(key) ?? []), id]);
    }
  }
  return operationsOf(combined.document).flatMap(({ route, method }) => {
    const key = `${method.toUpperCase()} ${route}`;
    const ids = owners.get(key) ?? [];
    return ids.length === 1 ? [] : [`${key} appears in ${ids.length} area documents (${ids.join(', ') || 'none'})`];
  });
}

function renderIndex(allDocuments) {
  const rows = allDocuments.map(({ id, title, document }) => {
    const operations = operationsOf(document).length;
    const schemas = Object.keys(document.components?.schemas ?? {}).length;
    return `| [${title}](${id}.yaml) | \`/api/docs/${id}.json\` | ${operations} | ${schemas} |`;
  });
  return [
    '---',
    'doc_class: technical',
    'audience: developer, architect',
    'publication: github',
    'lifecycle: reference',
    '---',
    '# EnterpriseGlue OpenAPI documents',
    '',
    `Generated by \`pnpm run docs:openapi\` from the contract in \`packages/shared/src/schemas/openapi.ts\`. Do not edit these files by hand; CI fails when they drift.`,
    '',
    'A running backend serves the same documents as JSON (paths below) and lists them all in Swagger UI at `/api/docs`.',
    '',
    '| Document | Served at | Operations | Schemas |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'Tenant-scoped routes are documented as `/api/t/{tenantSlug}/...`; the backend also serves them at the legacy alias `/t/{tenantSlug}/api/...`.',
    '',
  ].join('\n');
}
