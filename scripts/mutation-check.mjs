#!/usr/bin/env node
// Mutation pinning: break each real-behaviour rule in a throwaway copy of server/ and require the server tests to FAIL.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTATIONS = [
  ['flow: act claim dropped from the OBO token', 'flow.js', "act: { sub: AGENT.clientId, iss: ISSUER },", ""],
  ['flow: sub swapped to the agent (impersonation)', 'flow.js', "iss: ISSUER, sub: PERSONA.sub, aud: GW.aud, client_id: 'token-exchanger',", "iss: ISSUER, sub: AGENT.clientId, aud: GW.aud, client_id: 'token-exchanger',"],
  ['flow: OBO token narrowed per tool (must NOT narrow)', 'flow.js', "scope: 'api:read api:write api:delete', iat, exp: iat + 300,\n        act:", "scope: 'api:read', iat, exp: iat + 300,\n        act:"],
  ['flow: approval not required to permit', 'flow.js', "const approved = replayed && state.approvals[identifierHeader] === 'approved' && state.approvals[`${identifierHeader}:used`] === undefined;", "const approved = replayed;"],
  ['flow: identifier not single use', 'flow.js', "if (approved) state.approvals[`${identifierHeader}:used`] = 'used'; // single use", ""],
  ['downstream: act requirement not enforced', 'jwt.js', "if (requireAct && !claims.act) return { ok: false, why: 'no act claim: a token that is not delegated does not name an agent' };", "if (false) return { ok: false };"],
  ['downstream: signature not verified', 'jwt.js', "if (expected !== parts[2]) return { ok: false, why: 'bad signature' };", "if (false) return { ok: false };"],
  ['safety: cross-origin writes accepted', 'safety.js', "if (site && site !== 'same-origin' && site !== 'none') return res.status(403)", "if (false) return res.status(403)"],
];

export function mutantSource(source, [label, file, find, replace]) {
  if (!source.includes(find)) return null;
  return source.replace(find, replace);
}

export function runMutations({ only } = {}) {
  const results = [];
  for (const m of MUTATIONS) {
    if (only && !m[0].includes(only)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciba-mut-'));
    try {
      fs.cpSync(path.join(ROOT, 'server'), path.join(dir, 'server'), { recursive: true });
      const target = path.join(dir, 'server/src', m[1]);
      const source = fs.readFileSync(target, 'utf8');
      const mutated = mutantSource(source, m);
      if (mutated === null) { results.push({ ...m, status: 'not-applied' }); continue; }
      fs.writeFileSync(target, mutated);
      const r = spawnSync('node', ['--test', 'test/*.test.js'], { cwd: path.join(dir, 'server'), encoding: 'utf8', timeout: 120_000 });
      results.push({ ...m, status: r.status !== 0 ? 'killed' : 'SURVIVED' });
    } catch (e) {
      results.push({ ...m, status: 'error', detail: e.message });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : undefined;
  const results = runMutations({ only });
  let survivors = 0;
  for (const r of results) {
    if (r.status === 'SURVIVED') survivors++;
    console.log(`${r.status.padEnd(12)} ${r[0]}`);
    if (r.detail) console.log(`             ${r.detail}`);
  }
  console.log(survivors ? `\n${survivors} mutant(s) survived — a rule is not pinned` : '\nall mutants killed');
  process.exit(survivors ? 1 : 0);
}
