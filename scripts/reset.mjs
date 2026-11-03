#!/usr/bin/env node
// Reset a running obo-lab: bumps the epoch so other open pages notice, and clears nothing else (the lab holds no state).
//   node scripts/reset.mjs [base-url]      (default http://localhost:${PORT:-7560})
// Loopback only: refuses any other host. Needs the server already running; sends the same-origin header the server requires.
import { isLoopbackHost } from '../server/src/safety.js';

export async function reset(base = `http://localhost:${process.env.PORT || 7560}`) {
  const u = new URL(base);
  if (!isLoopbackHost(u.hostname)) throw new Error(`refusing ${u.hostname}: loopback only`);
  let r;
  try { r = await fetch(new URL('/api/reset', u), { method: 'POST', headers: { 'content-type': 'application/json', origin: u.origin }, body: '{}' }); }
  catch { throw new Error(`no lab is listening at ${u.origin}; start it first (npm start) or pass the base URL`); }
  if (!r.ok) throw new Error(`reset failed: HTTP ${r.status}`);
  return r.json();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  reset(process.argv[2]).then((j) => console.log(`reset: ok (epoch ${j.epoch})`), (e) => { console.error(e.message); process.exit(1); });
}
