import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function sessionHarness(run) {
  const original = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  const states = [], effects = [], queued = [], requests = [], timers = new Map(), storage = new Map();
  let cursor = 0, timerId = 0;
  const context = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef(value) { const index = cursor++; return states[index] ||= { current: value }; },
    useEffect(callback, deps) {
      const index = cursor++, previous = effects[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.();
        effects[index] = { deps };
        queued.push(() => { effects[index].cleanup = callback(); });
      }
    },
    useI18n: () => i18n,
    localizeSnapshotGameNames: (snapshot) => snapshot,
    seasonName: (season) => season,
    sessionSummary: (snapshot) => ({ profileId: snapshot.profileId }),
  };
  const i18n = { t: (key) => key, gameCatalog: {} };
  globalThis.__dashboardSessionTest = context;
  globalThis.document = { hidden: false };
  globalThis.window = {
    setInterval: (callback, ms) => { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearInterval: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => { callback(); return 0; }, cancelAnimationFrame() {},
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  };
  globalThis.fetch = (url) => new Promise((resolve) => requests.push({ url, resolve: (payload) => resolve({ ok: true, json: async () => payload }) }));
  try {
    const source = await readFile(new URL("../app/dashboard/use-dashboard-session.ts", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    const code = outputText.replace(/import\s*\{([^}]+)\}\s*from "[^"]+";/g, "const {$1} = globalThis.__dashboardSessionTest;");
    const { useDashboardSession: sessionHook } = await import(`data:text/javascript;base64,${Buffer.from(code + `\n// ${Math.random()}`).toString("base64")}`);
    const render = () => { cursor = 0; const session = sessionHook(); while (queued.length) queued.shift()(); return session; };
    const dispose = () => effects.forEach((effect) => effect?.cleanup?.());
    await run({ render, dispose, requests, storage, timers });
    dispose();
  } finally {
    Object.assign(globalThis, original);
    delete globalThis.__dashboardSessionTest;
  }
}

test("session cleanup ignores pending responses and clears its polling timers", async () => {
  await sessionHarness(async ({ render, dispose, requests, timers }) => {
    render();
    assert.equal(timers.size, 2);
    dispose();
    assert.equal(timers.size, 0);
    for (const request of requests) request.resolve({ profileId: "synthetic", entries: [] });
    await flush();
    assert.equal(render().data, null);
  });
});

test("changing farms isolates baseline, history and delayed LIVE responses", async () => {
  await sessionHarness(async ({ render, requests, timers, storage }) => {
    storage.set("stardew-tool-last-session-A", JSON.stringify({ profileId: "A", money: 10 }));
    storage.set("stardew-tool-last-session-B", JSON.stringify({ profileId: "B", money: 20 }));
    render();
    const resolveLatest = async (profileId) => {
      requests.findLast((r) => r.url.includes("farm-state")).resolve({ profileId, dayIndex: 2 });
      requests.findLast((r) => r.url.includes("farm-history")).resolve({ profileId, entries: [] });
      await flush();
    };
    await resolveLatest("A");
    let session = render();
    assert.equal(session.sessionBaseline.money, 10);
    const delayedA = requests.findLast((r) => r.url.includes("live-state"));
    [...timers.values()].find((timer) => timer.ms === 5000).callback();
    await resolveLatest("B");
    session = render();
    assert.equal(session.history.profileId, "B");
    assert.equal(session.sessionBaseline.money, 20);
    delayedA.resolve({ active: true, profileId: "A", updatedAt: new Date().toISOString() });
    await flush();
    session = render();
    assert.equal(session.live.profileId, "B");
    assert.equal(session.live.active, false);
    assert.equal(session.previousDay, null);
    assert.equal(JSON.parse(storage.get("stardew-tool-last-session-A")).profileId, "A");
  });
});
