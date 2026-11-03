// The 24-step diagram, loaded from the server's catalog (steps + groups). Rule 17: the data is
// server-side; this component only renders nodes/edges from it. Movable boxes, Simulate, Reset
// (restores positions), speed control.
import React, { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, Panel, MarkerType, Handle, Position, useNodesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const BASE = [
  { id: "browser", x: 0, y: 150, label: "Browser" },
  { id: "app", x: 420, y: 0, label: "Application" },
  { id: "iam", x: 860, y: 0, label: "IAM Core", sub: "PingFederate / PingOne" },
  { id: "agent", x: 420, y: 330, label: "Agent" },
  { id: "gw", x: 860, y: 330, label: "MCP Gateway" },
  { id: "authz", x: 1300, y: 330, label: "Authorize", sub: "policy decision + CIBA", authz: true },
  { id: "mcp", x: 860, y: 700, label: "MCP Server" },
  { id: "res", x: 1300, y: 700, label: "Resource Server" },
];

// Each step's edge: endpoints + handle ids (10/30/50/70/90 percent positions per side).
const EDGES = [
  { f: "browser", fh: "r10", t: "app", th: "l30" },
  { f: "app", fh: "r30", t: "iam", th: "l30" },
  { f: "browser", fh: "r50", t: "iam", th: "l70", both: true },
  { f: "iam", fh: "l50", t: "app", th: "r70" },
  { f: "agent", fh: "t50", t: "iam", th: "b10" },
  { f: "iam", fh: "b30", t: "agent", th: "t50" },
  { f: "agent", fh: "t50", t: "iam", th: "b50", both: true },
  { f: "app", fh: "b10", t: "agent", th: "t10" },
  { f: "agent", fh: "r10", t: "gw", th: "l10", type: "straight" },
  { f: "gw", fh: "r10", t: "authz", th: "l10" },
  { f: "authz", fh: "l30", t: "gw", th: "r30" },
  { f: "gw", fh: "l30", t: "agent", th: "r30", type: "straight" },
  { f: "agent", fh: "t30", t: "app", th: "b30" },
  { f: "app", fh: "b70", t: "agent", th: "t70" },
  { f: "agent", fh: "r50", t: "gw", th: "l50", type: "straight" },
  { f: "gw", fh: "r50", t: "authz", th: "l50" },
  { f: "authz", fh: "l70", t: "gw", th: "r70" },
  { f: "gw", fh: "b30", t: "mcp", th: "t30" },
  { f: "mcp", fh: "r30", t: "res", th: "l30" },
  { f: "res", fh: "l70", t: "mcp", th: "r70" },
  { f: "mcp", fh: "r50", t: "authz", th: "b50" },
  { f: "authz", fh: "l90", t: "gw", th: "r90" },
  { f: "gw", fh: "l70", t: "agent", th: "r70", type: "straight" },
  { f: "agent", fh: "t90", t: "app", th: "b90" },
];

const SIDES = { l: Position.Left, r: Position.Right, t: Position.Top, b: Position.Bottom };
const POS = [10, 30, 50, 70, 90];

function Box({ data }) {
  return (
    <div className={"dnode" + (data.authz ? " authz" : "") + (data.hot ? " hot" : "")}>
      {Object.entries(SIDES).map(([k, pos]) =>
        POS.map((p) => (
          <Handle key={k + p} id={k + p} type="source" position={pos}
            style={(k === "l" || k === "r") ? { top: `${p}%` } : { left: `${p}%` }} />
        )))}
      <div>{data.label}</div>
      {data.sub ? <small>{data.sub}</small> : null}
    </div>
  );
}
const nodeTypes = { box: Box };

export default function FlowTab({ catalog }) {
  const steps = catalog?.steps ?? [];
  const groups = catalog?.groups ?? [];
  const groupOf = (i) => groups.findIndex((g) => i + 1 >= g.from && i + 1 <= g.to);

  const initNodes = useMemo(() => BASE.map((n) => ({ id: n.id, type: "box", position: { x: n.x, y: n.y }, data: n })), []);
  const [version, setVersion] = useState(0); // bumped by Reset to restore positions
  const ns = useNodesState(initNodes);
  const nodes = ns[0], setNodes = ns[1], onNodesChange = ns[2];
  useEffect(() => { setNodes(initNodes); setVersion((v) => v + 1); }, [initNodes, setNodes]); // eslint-disable-line

  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState(-1);
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => { if (running) setOpen(step); }, [running, step]);
  useEffect(() => { if (step >= 0) setCollapsed((c) => { const n = { ...c }; delete n[steps[step] ? groupOf(step) : -1]; return n; }); }, [step]); // eslint-disable-line
  useEffect(() => {
    if (!running) return undefined;
    if (step >= steps.length - 1) { setRunning(false); return undefined; }
    const t = setTimeout(() => setStep((s) => s + 1), 2800 / speed);
    return () => clearTimeout(t);
  }, [running, step, speed, steps.length]);

  const edges = useMemo(() => steps.map((s, i) => {
    const e = EDGES[i];
    if (!e) return null;
    const g = groupOf(i);
    const color = groups[g]?.color ?? "#5b6b7f";
    const active = i === step, seen = i < step;
    const marker = { type: MarkerType.ArrowClosed, color };
    return {
      id: `e${i}`, source: e.f, sourceHandle: e.fh, target: e.t, targetHandle: e.th,
      type: e.type || "smoothstep", animated: active,
      label: String(i + 1), labelBgPadding: [5, 3], labelBgBorderRadius: 8,
      labelStyle: { fontWeight: 700, fill: color },
      labelBgStyle: { fill: "var(--panel, #fff)", stroke: color, strokeWidth: 1.5 },
      style: { stroke: color, strokeWidth: active ? 3.5 : 1.8, opacity: step === -1 ? 0.9 : active ? 1 : seen ? 0.7 : 0.3 },
      markerEnd: marker, markerStart: e.both ? marker : undefined,
      zIndex: active ? 10 : 1,
    };
  }).filter(Boolean), [steps, groups, step]);

  const shownNodes = useMemo(() => {
    const hot = step >= 0 && EDGES[step] ? [EDGES[step].f, EDGES[step].t] : [];
    return nodes.map((n) => ({ ...n, data: { ...n.data, hot: hot.includes(n.id) } }));
  }, [nodes, step]);

  const curG = step >= 0 ? groupOf(step) : -1;
  const reset = () => { setRunning(false); setStep(-1); setOpen(-1); setNodes(initNodes); setVersion((v) => v + 1); };
  const simulate = () => {
    if (running) { setRunning(false); return; }
    if (step >= steps.length - 1 || step < 0) setStep(0);
    setRunning(true);
  };

  const s = step >= 0 ? steps[step] : null;
  return (
    <div className="flowwrap">
      <div className="flow-tools">
        <button type="button" className="btn primary" onClick={simulate}>{running ? "Pause" : step >= steps.length - 1 ? "Replay" : "Simulate"}</button>
        <button type="button" className="btn" onClick={() => { setRunning(false); setStep((x) => Math.min(x + 1, steps.length - 1)); }}>Next step</button>
        <button type="button" className="btn" onClick={reset}>Reset</button>
        <label className="inline">Speed
          <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}>
            <option value="0.5">0.5x</option><option value="1">1x</option><option value="2">2x</option><option value="4">4x</option>
          </select>
        </label>
      </div>
      <div className="caption" role="status">
        {s ? (
          <>
            <b>{groups[curG]?.name} · step {step + 1} of {steps.length} · {s.label}.</b> {s.what}
            {s.token ? <pre data-testid="cap-token">{JSON.stringify(s.token, null, 2)}</pre> : null}
            {s.rpc ? <pre data-testid="cap-rpc">{JSON.stringify(s.rpc, null, 2)}</pre> : null}
          </>
        ) : <>Press <b>Simulate</b> to walk the flow step by step, or click a step in the list to expand it. Drag any box to rearrange (Reset restores the layout).</>}
      </div>
      <div className="flow-main">
        <div className="steplist" data-testid="steplist">
          {groups.map((g, gi) => (
            <React.Fragment key={g.name}>
              <div className={"grp" + (gi === curG ? " on" : "")} style={{ "--gc": g.color }} role="button" tabIndex={0}
                onClick={() => setCollapsed((c) => ({ ...c, [gi]: !c[gi] }))}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed((c) => ({ ...c, [gi]: !c[gi] })); } }}>
                <span>{g.name}</span><small>{g.from === g.to ? `step ${g.from}` : `steps ${g.from}-${g.to}`}</small>
              </div>
              {collapsed[gi] ? null : steps.map((st, i) => {
                if (groupOf(i) !== gi) return null;
                return (
                  <div key={i} className={"item" + (i === step ? " on" : i < step ? " seen" : "")} style={{ "--gc": g.color }}>
                    <div className="head" role="button" tabIndex={0}
                      onClick={() => { setRunning(false); setStep(i); setOpen(open === i ? -1 : i); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRunning(false); setStep(i); setOpen(open === i ? -1 : i); } }}>
                      <span className="n">{i + 1}</span><span>{st.label}</span>
                    </div>
                    {open === i ? (
                      <div className="detail">
                        <h4>What happens</h4><p>{st.what}</p>
                        <h4>Why it matters</h4><p>{st.why}</p>
                        {st.token ? <pre>{JSON.stringify(st.token, null, 2)}</pre> : null}
                        {st.rpc ? <pre>{JSON.stringify(st.rpc, null, 2)}</pre> : null}
                        {st.open ? (<><h4>Open</h4><p className="open">{st.open}</p></>) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="canvas" data-testid="diagram">
          <ReactFlow key={version} nodes={shownNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
            connectionMode="loose" nodesConnectable={false} fitView fitViewOptions={{ padding: 0.1 }} minZoom={0.3} proOptions={{ hideAttribution: true }}>
            <Background gap={20} />
            <Controls showInteractive={false} />
            <Panel position="bottom-left" className="legend">
              {groups.map((g, gi) => (
                <button key={g.name} type="button" className={"chip" + (gi === curG ? " on" : "")} style={{ "--gc": g.color }}
                  title={g.name} onClick={() => { setRunning(false); setStep(g.from - 1); setOpen(g.from - 1); }}>
                  <b>{g.from === g.to ? g.from : `${g.from}-${g.to}`}</b> {g.name}
                </button>
              ))}
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
