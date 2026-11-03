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
