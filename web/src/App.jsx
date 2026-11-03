import React, { useCallback, useEffect, useState } from "react";
import { getCatalog, getInfo, requestModeSwitch, resetServer, runWrite, approveCiba, denyCiba } from "./lib/api.js";
import ModeToggle from "./components/ModeToggle.jsx";
import FlowTab from "./tabs/FlowTab.jsx";
import RunTab from "./tabs/RunTab.jsx";

export const TABS = [["flow", "Flow"], ["run", "Live run"]];
export const FALLBACK_BANNER = "MOCK mode. SIMULATED: in-process mock IAM, mock Authorize policy, mock CIBA, mock gateway and mock MCP/RS. No tenant, no outbound network.";
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* not remembered */ } };
const tabFromHash = () => { const id = window.location.hash.replace(/^#\/?/, "").split("?")[0]; return TABS.some(([t]) => t === id) ? id : "flow"; };
const typing = (t) => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

export default function App() {
  const [catalog, setCatalog] = useState(null);
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState(tabFromHash);
  const [theme, setTheme] = useState(() => (["light", "dark"].includes(read("ciba.theme", "")) ? read("ciba.theme", "") : "system"));
  const [present, setPresent] = useState(() => read("ciba.present", "0") === "1");
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [announce, setAnnounce] = useState("");

  const loadAll = useCallback(async () => {
    const [c, i] = await Promise.all([getCatalog(), getInfo()]);
    setCatalog(c); setInfo(i);
  }, []);
  useEffect(() => { loadAll().catch((e) => setLoadError(e.message)); }, [loadAll]);
  useEffect(() => { const on = () => setTab(tabFromHash()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  useEffect(() => { if (theme === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (present) document.documentElement.dataset.present = "1"; else delete document.documentElement.dataset.present; }, [present]);
  useEffect(() => {
    const on = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.key === "p" || e.key === "P") setPresent((v) => { write("ciba.present", v ? "0" : "1"); return !v; });
      else if (e.key === "Escape") setPresent((v) => { if (v) write("ciba.present", "0"); return false; });
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const onWrite = useCallback(async (identifierHeader) => {
    setBusy(true); setError(null);
    try {
      const r = await runWrite(identifierHeader || undefined);
      setRun(r);
      setAnnounce(r.outcome === "permit" ? "Permitted: the CIBA approval was verified and the tool ran."
        : r.outcome === "hitl_required" ? "Denied with an identifier: approve as the human, then replay."
        : `Result: ${r.outcome}.`);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }, []);
  const onApprove = useCallback(async (id) => { setBusy(true); setError(null); try { await approveCiba(id); setAnnounce("Approved. Replay the write with the identifier."); } catch (e) { setError(e.message); } setBusy(false); }, []);
  const onDeny = useCallback(async (id) => { setBusy(true); setError(null); try { await denyCiba(id); setAnnounce("Refused. A replay with this identifier denies again."); } catch (e) { setError(e.message); } setBusy(false); }, []);
  const onReset = useCallback(async () => { await resetServer(); setRun(null); setAnnounce("Reset."); }, []);

  const onMode = useCallback(async (next) => {
    try {
      const r = await requestModeSwitch(next);
      setInfo(r);
      setAnnounce(r.message ?? `Mode: ${r.source}.`);
      setRun(null);
      const c = await getCatalog(); setCatalog(c); // reload all data after a switch (rule 19)
    } catch (e) { setAnnounce(e.message); }
  }, []);

  const banner = info?.banner ?? FALLBACK_BANNER;

  if (loadError || !catalog) {
    return (
      <>
        <a className="skip" href="#main">Skip to content</a>
        <header><p className="banner">{FALLBACK_BANNER}</p></header>
        <main className="page" id="main" tabIndex={-1}>
          {loadError ? <p className="alert" role="alert">Could not reach the lab server: {loadError}</p> : <p className="muted" role="status">Loading the lab...</p>}
        </main>
      </>
    );
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header>
        <p className="banner" data-testid="banner">{banner}</p>
        <div className="head">
          <h1 className="head__title"><span className="head__mark">CIBA</span>CIBA HITL Lab</h1>
          <div className="head__tools">
            <ModeToggle info={info} onSelect={onMode} />
            <button type="button" className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Theme</button>
            <button type="button" className="btn" aria-pressed={present} onClick={() => setPresent((v) => { write("ciba.present", v ? "0" : "1"); return !v; })}>Present</button>
          </div>
        </div>
        <nav aria-label="Tabs" className="tabs">
          {TABS.map(([id, label]) => <a key={id} href={`#/${id}`} aria-current={tab === id ? "page" : undefined} className="tab">{label}</a>)}
        </nav>
      </header>
      <main className="page" id="main" tabIndex={-1}>
        {tab === "flow"
          ? <FlowTab catalog={catalog} />
          : <RunTab run={run} busy={busy} error={error} onWrite={onWrite} onApprove={onApprove} onDeny={onDeny} onReset={onReset} source={info?.source} />}
      </main>
      <footer><p className="muted small">One login, one token exchange, one approval. The OBO token keeps the full scope set; per-tool narrowing happens in the Authorize policy, and a write only runs after a human - verified by Authorize, never by the agent.</p></footer>
      <div aria-live="polite" className="visually-hidden">{announce}</div>
    </>
  );
}
