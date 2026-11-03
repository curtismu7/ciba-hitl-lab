// The live run: a write call against the lab. First call -> DENY + identifier + the JSON-RPC 2.0
// error the gateway returns. Approve (or refuse) as the human, replay with the identifier header,
// and Authorize verifies the CIBA record: PERMIT, tool runs, result returns.
import React, { useState } from "react";

export default function RunTab({ run, busy, error, onWrite, onApprove, onDeny, onReset, source }) {
  const [identifier, setIdentifier] = useState("");
  const current = run?.identifier ?? "";
  return (
    <section aria-label="Run" className="stack">
      <div className="card">
        <h3>Run the write</h3>
        <p className="muted small">One write, end to end: the OBO token carries the full scope set; the Authorize policy - not the token - demands a human for writes.</p>
        <div className="actions">
          <button type="button" className="btn primary" data-testid="run-write" disabled={busy} onClick={() => onWrite(identifier)}>Call the write tool</button>
          {run?.outcome === "hitl_required" ? (
            <>
              <button type="button" className="btn" data-testid="run-approve" disabled={busy} onClick={() => onApprove(run.identifier)}>Approve as the human (CIBA)</button>
              <button type="button" className="btn" data-testid="run-deny" disabled={busy} onClick={() => onDeny(run.identifier)}>Refuse</button>
            </>
          ) : null}
          {run ? <button type="button" className="btn" data-testid="run-reset" disabled={busy} onClick={onReset}>Reset state</button> : null}
        </div>
        {run ? (
          <div className="replay">
            <label className="inline" htmlFor="idhdr">Identifier header (replay)</label>
            <input id="idhdr" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="paste the identifier" />
            <button type="button" className="btn" data-testid="run-replay" disabled={busy || !identifier} onClick={() => onWrite(identifier)}>Replay with identifier</button>
          </div>
        ) : null}
        {error ? <p className="alert" role="alert">{error}</p> : null}
      </div>

      {run ? (
        <div className="card" data-testid="result">
          <h3>Result: <span data-testid="outcome">{run.outcome ?? "-"}</span>{run.decision ? <> · decision <b>{run.decision.result}</b></> : null}</h3>
          {run.rpcError ? (
            <div>
              <h4>The gateway rewrote the 403 into a JSON-RPC 2.0 error (the session survives)</h4>
              <pre className="wire" data-testid="rpc">{JSON.stringify(run.rpcError, null, 2)}</pre>
            </div>
          ) : null}
          {run.decision ? (
            <p className="small" data-testid="decision">Policy inputs: sub <code>{run.decision.sub}</code>, act <code>{run.decision.act}</code>, tool <code>{run.decision.tool}</code> - {run.decision.reason}</p>
          ) : null}
          {run.mcp ? (
            <div>
              <h4>MCP tool result</h4>
              <pre className="wire" data-testid="mcp">{JSON.stringify(run.mcp, null, 2)}</pre>
            </div>
          ) : null}
          {run.obo ? (
            <div>
              <h4>OBO token (decoded{source === "real" ? ", hash only in Real mode" : ", mock"})</h4>
              <pre className="wire" data-testid="obo">{JSON.stringify(source === "real" ? run.obo.claims ?? run.obo : run.obo.claims, null, 2)}</pre>
            </div>
          ) : null}
          {run.delta ? (
            <p className="small" data-testid="delta">Live exchange: sub kept {String(run.delta.subSame)}, act added {String(run.delta.actAdded)}, full scopes kept {String(run.delta.fullScopesKept)}.</p>
          ) : null}
          {run.simulatedLegs ? (
            <p className="small muted">Simulated in Real mode too: {run.simulatedLegs.join(", ")}.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
