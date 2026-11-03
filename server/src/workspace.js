// Rule 13: the workspaceId namespaces every piece of per-visitor state (runs, revocation, future
// trace sinks). Default 'default'. It arrives as the ciba_ws cookie (host-set, loopback only) or
// falls back to 'default'; a hosted build would derive it from the visitor, per the rulebook.
const VALID = /^[a-z0-9-]{1,40}$/;

export function workspaceId(req) {
  const raw = String(req?.cookies?.ciba_ws ?? req?.headers?.['x-ciba-ws'] ?? 'default');
  return VALID.test(raw) ? raw : 'default';
}

export const WORKSPACE_DEFAULT = 'default';
