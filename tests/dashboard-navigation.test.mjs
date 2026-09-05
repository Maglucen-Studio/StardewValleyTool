import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

test("navigation preserves section history, shortcuts and listener cleanup", async () => {
  const originalWindow = globalThis.window;
  const storage = new Map([["stardew-tool-active-view", "map"]]);
  const events = new EventTarget();
  const states = [];
  const effects = [];
  let stateIndex = 0;
  globalThis.window = Object.assign(events, {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  globalThis.__navigationTestHooks = {
    useRef: (current) => ({ current }),
    useState: (initial) => {
      const index = stateIndex++;
      states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useCallback: (callback) => callback,
    useEffect: (effect) => effects.push(effect),
  };
  let cleanup = [];
  try {
    const source = await readFile(new URL("../app/dashboard/use-dashboard-navigation.ts", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    const code = outputText.replace(/import\s*\{([^}]+)\}\s*from "react";/, "const {$1} = globalThis.__navigationTestHooks;");
    const { useDashboardNavigation } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    const navigation = useDashboardNavigation();
    cleanup = effects.map((effect) => effect()).filter(Boolean);
    assert.equal(navigation.activeView, "map");
    navigation.navigateTo({ view: "planning", section: "community" });
    navigation.navigateTo({ view: "fishing" });
    navigation.navigateHistory("back");
    assert.equal(states[0], "planning");
    assert.equal(storage.get("stardew-tool-plan-section"), "community");
    assert.deepEqual(states[1], { back: true, forward: true });
    navigation.navigateHistory("forward");
    assert.equal(states[0], "fishing");
    navigation.navigateTo({ view: "growth" });
    assert.deepEqual(states[1], { back: true, forward: false });
    assert.equal(storage.get("stardew-tool-progress-section"), "growth");
    const shortcut = () => Object.assign(new Event("keydown", { cancelable: true }), { altKey: true, key: "ArrowLeft" });
    events.dispatchEvent(shortcut());
    assert.equal(states[0], "fishing");
    cleanup.forEach((dispose) => dispose());
    cleanup = [];
    events.dispatchEvent(shortcut());
    assert.equal(states[0], "fishing", "unmounted navigation must remove its keyboard listener");
  } finally {
    cleanup.forEach((dispose) => dispose());
    globalThis.window = originalWindow;
    delete globalThis.__navigationTestHooks;
  }
});
