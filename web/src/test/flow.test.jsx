import { test, expect, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import App, { FALLBACK_BANNER } from "../App.jsx";
import { runWrite, approveCiba, requestModeSwitch, getInfo } from "../lib/api.js";

vi.mock("../lib/api.js", () => ({
  requestModeSwitch: vi.fn(async (source) => ({ source, realAvailable: false, realReason: "Set PINGONE_* in ~/Development/.env", banner: "B" })),
  getCatalog: vi.fn(async () => ({
    banner: "B", source: "mock",
    persona: { sub: "user.0042", clientId: "web-banking" },
    agent: { clientId: "personal-agent" },
    gateway: { aud: "https://ai-gateway.invalid" },
    downstream: { aud: "https://api.fabrikam.example" },
    diagram: {
      title: "CIBA HITL", intro: "i",
      groups: { login: { label: "G1", color: "blue" }, write: { label: "G2", color: "red" } },
      nodes: [
        { id: "app", label: "Application", kind: "login", x: 0, y: 0 },
        { id: "gw", label: "Gateway", kind: "write", x: 300, y: 200 },
      ],
      edges: Array.from({ length: 24 }, (_, i) => ({ from: "app", to: "gw", dashed: false })),
      steps: Array.from({ length: 24 }, (_, i) => ({ from: "app", to: "gw", label: `Step ${i + 1}`, what: `w${i + 1}`, why: `y${i + 1}` })),
    },
  })),
  getInfo: vi.fn(async () => ({ source: "mock", realAvailable: false, realReason: "Set PINGONE_*", banner: "B" })),
  resetServer: vi.fn(async () => ({ ok: true })),
  runWrite: vi.fn(),
  approveCiba: vi.fn(async () => ({ ok: true })),
  denyCiba: vi.fn(async () => ({ ok: true })),
  decodeToken: vi.fn(),
}));

test("flow tab: 24 numbered steps, simulate walks to step 1, the owner-approved names show", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId("banner");
  expect(screen.getByTestId("steplist").textContent).toContain("Step 24");
  await user.click(screen.getByRole("button", { name: "Simulate" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/step 1 of 24/), { timeout: 4000 });
});

test("live run: write -> hitl_required with the JSON-RPC rewrite; approve -> replay permits", async () => {
  runWrite.mockResolvedValueOnce({
    ok: true, outcome: "hitl_required", identifier: "ciba-1", source: "mock",
    rpcError: { jsonrpc: "2.0", id: 1, error: { code: -32001, message: "Approval required", data: { identifier: "ciba-1" } } },
    decision: { sub: "user.0042", act: "personal-agent", tool: "update_record", result: "DENY", reason: "write requires human-in-the-loop" },
    obo: { claims: { sub: "user.0042", act: { sub: "personal-agent" } } },
  });
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId("banner");
  await user.click(screen.getByRole("link", { name: "Live run" }));
  await user.click(screen.getByTestId("run-write"));
  await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("hitl_required"));
  expect(screen.getByTestId("rpc")).toHaveTextContent("-32001");
  // approve, then replay
  runWrite.mockResolvedValueOnce({
    ok: true, outcome: "permit", identifier: "ciba-1", source: "mock",
    decision: { sub: "user.0042", act: "personal-agent", tool: "update_record", result: "PERMIT", reason: "CIBA approval verified" },
    mcp: { status: 200, result: { record: "id-9012", status: "updated" } },
    obo: { claims: { sub: "user.0042", act: { sub: "personal-agent" } } },
  });
  await user.click(screen.getByTestId("run-approve"));
  await waitFor(() => expect(approveCiba).toHaveBeenCalledWith("ciba-1"));
  await user.type(screen.getByLabelText(/Identifier header/), "ciba-1");
  await user.click(screen.getByTestId("run-replay"));
  await waitFor(() => expect(screen.getByTestId("outcome")).toHaveTextContent("permit"));
  expect(screen.getByTestId("mcp")).toHaveTextContent("updated");
});

test("rule 19: the toggle renders both buttons; Real disabled with how-to when unconfigured", async () => {
  render(<App />);
  await screen.findByTestId("banner");
  const real = screen.getByTestId("mode-real");
  expect(real).toBeDisabled();
  expect(real.getAttribute("title")).toMatch(/PINGONE/);
  expect(screen.getByTestId("mode-mock").getAttribute("aria-pressed")).toBe("true");
});

test("mode switch reloads data and the run", async () => {
  const user = userEvent.setup();
  // make Real available from the first load, as a configured server would
  getInfo.mockResolvedValue({ source: "mock", realAvailable: true, banner: "B" });
  render(<App />);
  await screen.findByTestId("banner");
  await waitFor(() => expect(screen.getByTestId("mode-real")).not.toBeDisabled());
  requestModeSwitch.mockResolvedValueOnce({ source: "real", realAvailable: true, banner: "REAL B" });
  await user.click(screen.getByTestId("mode-real"));
  await waitFor(() => expect(requestModeSwitch).toHaveBeenCalledWith("real"));
  await waitFor(() => expect(screen.getByTestId("banner")).toHaveTextContent("REAL B"));
});
