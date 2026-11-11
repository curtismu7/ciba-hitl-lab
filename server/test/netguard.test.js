// Netguard outbound allowlist: Mock (empty allowlist) blocks every non-loopback host; Real mode's allowlist
// (the PingOne auth hosts) passes exactly those and still blocks everything else. installNetguard is a process
// singleton, so the two behaviours are tested with restore() between the phases.
import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import net from 'node:net';
import { installNetguard, outboundAllowlist } from '../src/netguard.js';

const guardedFetch = async (url) => fetch(url, { signal: AbortSignal.timeout(1500) });

test('outboundAllowlist is empty without PINGONE_ENVIRONMENT_ID and the PingOne auth hosts with it', () => {
  // STANDALONE_ENV points loadSharedEnv at an empty file: the test must not depend on the owner's ~/Development/.env.
  const saved = process.env.STANDALONE_ENV;
  process.env.STANDALONE_ENV = '/dev/null';
  try {
    assert.deepEqual(outboundAllowlist({}), []);
    const allow = outboundAllowlist({
      PINGONE_ENVIRONMENT_ID: 'x', PINGONE_WORKER_CLIENT_ID: 'id', PINGONE_WORKER_CLIENT_SECRET: 'sec', CIBA_LAB_AUDIENCE: 'aud',
    });
    assert.ok(allow.length >= 1);
    for (const h of allow) assert.match(h, /^auth\.pingone\./);
  } finally {
    if (saved === undefined) delete process.env.STANDALONE_ENV; else process.env.STANDALONE_ENV = saved;
  }
});

test('mock: empty allowlist blocks a non-loopback fetch, socket and DNS lookup', async () => {
  const guard = installNetguard({ outboundAllow: [] });
  try {
    await assert.rejects(guardedFetch('http://self-test.invalid/'), /network blocked/);
    assert.throws(() => net.connect({ host: 'self-test.invalid', port: 80 }), /network blocked/);
    await assert.rejects(new Promise((res, rej) => dns.lookup('self-test.invalid', (e) => (e ? rej(e) : res()))), /network blocked/);
    assert.ok(guard.attempts.length >= 3);
  } finally {
    guard.restore();
  }
});

test('real allowlist: auth.pingone.com passes the fetch guard (connection may still fail — DNS/TLS is not mocked here), other hosts stay blocked', async () => {
  const guard = installNetguard({
    outboundAllow: outboundAllowlist({
      PINGONE_ENVIRONMENT_ID: 'x', PINGONE_WORKER_CLIENT_ID: 'id', PINGONE_WORKER_CLIENT_SECRET: 'sec', CIBA_LAB_AUDIENCE: 'aud',
    }),
  });
  try {
    // auth.pingone.com must pass the GUARD. Without network the fetch itself fails with a non-blocked error;
    // with network it reaches the real endpoint. Either way it is not refused by the guard.
    let sawBlock = false;
    try { await guardedFetch('https://auth.pingone.com/health'); } catch (e) { sawBlock = /network blocked/.test(e.message); }
    assert.equal(sawBlock, false, 'auth.pingone.com must not be blocked by the guard when the allowlist carries it');
    await assert.rejects(guardedFetch('http://self-test.invalid/'), /network blocked/);
    await assert.rejects(new Promise((res, rej) => dns.lookup('self-test.invalid', (e) => (e ? rej(e) : res()))), /network blocked/);
    // subdomains of an allowed host pass; lookalikes do not.
    try { await guardedFetch('https://auth.pingone.com.evil.invalid/'); } catch (e) { assert.match(e.message, /network blocked/); }
  } finally {
    guard.restore();
  }
});

test('outboundAllowlist rejects a non-host entry (defence against a bad settings file)', () => {
  assert.throws(() => installNetguard({ outboundAllow: ['not a host'] }), /not a host name/);
});
