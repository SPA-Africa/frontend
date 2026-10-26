// Generates docs/API_ENDPOINTS.md and docs/api-endpoints.json from the endpoint registry.
// Run: npm run api:docs   (re-run whenever a service file changes)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import '../lib/api/services';
import { endpointRegistry, type EndpointMeta } from '../lib/api/define';
import { SERVICE_PREFIX } from '../lib/api/config';

const eps = [...endpointRegistry()].sort((a, b) => a.service.localeCompare(b.service) || a.id.localeCompare(b.id));
const out = join(__dirname, '..', 'docs');
mkdirSync(out, { recursive: true });

const serviceTitle: Record<string, string> = {
  core: 'core-svc (NestJS) at /api/core',
  ai: 'ai-svc (FastAPI) at /api/ai',
};

const domainOf = (e: EndpointMeta) => e.id.split('.')[0];
const cell = (s?: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

let md = `# API endpoints\n\nGenerated from \`lib/api/services\` by \`npm run api:docs\`. Do not edit by hand.\n\n`;
md += `${eps.length} endpoints. Types named in Request and Response live in \`lib/types.ts\` or in the service file that declares the endpoint.\n\n`;
md += `Legend: **Offline** means the client may replay the request after reconnecting, so honour \`Idempotency-Key\`. **Paged** means the response is \`Page<T>\` (\`items, page, pageSize, total\`).\n\n`;

for (const service of ['core', 'ai'] as const) {
  const list = eps.filter(e => e.service === service);
  md += `## ${serviceTitle[service]}\n\n`;
  const domains = [...new Set(list.map(domainOf))];
  for (const d of domains) {
    md += `### ${d}\n\n| Method | Path | Who | Summary | Request | Response | SRS | Emits |\n|---|---|---|---|---|---|---|---|\n`;
    for (const e of list.filter(x => domainOf(x) === d)) {
      const flags = [e.offline && 'Offline', e.paginated && 'Paged'].filter(Boolean).join(', ');
      const summary = [e.summary, e.query?.length ? `Query: ${e.query.join(', ')}` : '', e.notes ?? '', flags].filter(Boolean).join('. ');
      md += `| ${e.method} | \`${SERVICE_PREFIX[service]}${e.path}\` | ${e.roles.join(', ')} | ${cell(summary)} | ${cell(e.request ? `\`${e.request}\`` : '')} | \`${cell(e.response)}\` | ${(e.srs ?? []).join(', ')} | ${(e.emits ?? []).join(', ')} |\n`;
    }
    md += `\n`;
  }
}

const events = [...new Set(eps.flatMap(e => e.emits ?? []))].sort();
md += `## Domain events\n\nPublish these on the Redis/BullMQ bus after the change is committed (SRS 2.2.3).\n\n`;
for (const ev of events) md += `- \`${ev}\` from ${eps.filter(e => e.emits?.includes(ev)).map(e => `\`${e.id}\``).join(', ')}\n`;

writeFileSync(join(out, 'API_ENDPOINTS.md'), md);
writeFileSync(join(out, 'api-endpoints.json'), JSON.stringify(eps.map(e => ({ ...e, fullPath: `${SERVICE_PREFIX[e.service]}${e.path}` })), null, 2));
console.log(`Wrote ${eps.length} endpoints to docs/API_ENDPOINTS.md and docs/api-endpoints.json`);
