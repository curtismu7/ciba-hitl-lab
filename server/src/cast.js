// customer.config.json (optional, git-ignored) overrides the default cast. Read on every request so
// an edit shows on reload. Only the three cast values are read; everything else is ignored. Values
// are cleaned text, never markup.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanText } from './safety.js';

const FILE = process.env.CUSTOMER_CONFIG || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../customer.config.json');

const DEFAULTS = { brand: 'Fabrikam Bank', agentId: 'personal-agent', personName: 'Alex Person', host: 'fabrikam' };

export function cast() {
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const c = j.cast ?? {};
    const hostOk = (v) => /^[a-z0-9-]{1,40}$/.test(v);
    return {
      brand: cleanText(c.brand, 60) || DEFAULTS.brand,
      agentId: hostOk(c.agentId) ? c.agentId : DEFAULTS.agentId,
      personName: cleanText(c.personName, 60) || DEFAULTS.personName,
      host: hostOk(c.host) ? c.host : DEFAULTS.host,
      downstream: `https://api.${hostOk(c.host) ? c.host : DEFAULTS.host}.example`,
    };
  } catch { return { ...DEFAULTS, downstream: 'https://api.fabrikam.example' }; }
}

// {{token}} templating for the diagram data. Tokens: {{castBrand}}, {{castAgentId}}, {{castPersonName}}, {{castHost}}.
// A diagram token not in TOKEN_MAP is a bug (test-pinned by unfilled()).
const TOKEN = /\{\{(\w+)\}\}/g;
const TOKEN_MAP = { castBrand: 'brand', castAgentId: 'agentId', castPersonName: 'personName', castHost: 'host' };

export function unfilled(text, c = cast()) {
  return [...String(text).matchAll(TOKEN)].map((m) => m[1]).filter((k) => !TOKEN_MAP[k]);
}
export function fill(text, c = cast()) {
  return String(text).replace(TOKEN, (m, k) => (TOKEN_MAP[k] ? c[TOKEN_MAP[k]] : m));
}
export function fillDeep(value, c = cast()) {
  if (typeof value === 'string') return fill(value, c);
  if (Array.isArray(value)) return value.map((v) => fillDeep(v, c));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillDeep(v, c)]));
  return value;
}
