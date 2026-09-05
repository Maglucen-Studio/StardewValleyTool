import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

test("left and right clicks open the same proposal menu and an empty tile dismisses it", async () => {
  const writes = [];
  const proposal = { id: "synthetic", name: "Proposed Coop", x: 2, y: 3, width: 6, height: 3 };
  globalThis.__farmEditorInteraction = {
    useState: (initial) => {
      const value = typeof initial === "function" ? initial() : initial;
      return [Array.isArray(value) ? [proposal] : value, (next) => writes.push(next)];
    },
    useRef: (current) => ({ current }), useEffect: () => {},
    useMemo: (factory) => factory(), useCallback: (callback) => callback,
    useI18n: () => ({ t: (key) => key }),
    reconcileProposals: () => [], buildingType: () => "", validateFarmPlacement: () => "",
    tileKey: (x, y) => `${x}:${y}`, TILE: 16, tools: [],
  };
  try {
    const source = await readFile(new URL("../app/dashboard/use-farm-editor.ts", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    const code = outputText.replace(/import\s*\{([^}]+)\}\s*from "[^"]+";/g, "const {$1} = globalThis.__farmEditorInteraction;");
    const { useFarmEditor } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    const editor = useFarmEditor(null, { active: false }, "map");
    const event = (x, y) => ({
      clientX: x, clientY: y,
      currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 80, height: 65 }) },
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    });
    const left = event(3, 4);
    editor.handleClick(left);
    assert.deepEqual(writes.at(-1), { id: "synthetic", name: "Coop", x: 3, y: 4 });
    assert.equal(left.stopped, true, "the opening click must not reach the outside-click closer");
    editor.openProposalMenu(event(3, 4));
    assert.deepEqual(writes.at(-1), { id: "synthetic", name: "Coop", x: 3, y: 4 });
    editor.activateTile({ x: 3, y: 4 }, { x: 20, y: 30 });
    assert.deepEqual(writes.at(-1), { id: "synthetic", name: "Coop", x: 20, y: 30 }, "coordinate controls open the same proposal actions");
    editor.handleClick(event(0, 0));
    assert.equal(writes.at(-1), null);
  } finally {
    delete globalThis.__farmEditorInteraction;
  }
});

test("coordinate activation places, validates and moves proposals without mouse events", async () => {
  const states = [], requests = [];
  let cursor = 0, invalid = "";
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true }; };
  globalThis.__keyboardEditor = {
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef: (current) => ({ current }), useEffect() {}, useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useI18n: () => ({ t: (key) => key }), reconcileProposals: () => [], buildingType: () => "",
    validateFarmPlacement: () => invalid, tileKey: (x, y) => `${x}:${y}`, TILE: 16,
    tools: [{ id: "marker", label: "Synthetic marker", width: 1, height: 1 }],
  };
  try {
    const source = await readFile(new URL("../app/dashboard/use-farm-editor.ts", import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    const code = outputText.replace(/import\s*\{([^}]+)\}\s*from "[^"]+";/g, "const {$1} = globalThis.__keyboardEditor;");
    const { useFarmEditor: editorHook } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    const render = () => { cursor = 0; return editorHook(null, { active: false }, "map"); };
    let editor = render();
    editor.setProposalEditMode(true);
    editor.setTool("marker");
    editor = render();
    invalid = "Blocked tile";
    editor.activateTile({ x: 2, y: 3 }, { x: 0, y: 0 });
    assert.equal(requests.length, 0);
    assert.equal(render().placementError, "Blocked tile");
    invalid = "";
    editor.activateTile({ x: 2, y: 3 }, { x: 0, y: 0 });
    editor = render();
    assert.equal(editor.localSuggestions.length, 1);
    const proposal = editor.localSuggestions[0];
    assert.equal(editor.tool, "inspect");
    editor.setMovingProposalId(proposal.id);
    editor = render();
    editor.activateTile({ x: 5, y: 6 }, { x: 0, y: 0 });
    editor = render();
    assert.deepEqual(editor.localSuggestions[0], { ...proposal, x: 5, y: 6 });
    assert.equal(editor.movingProposalId, null);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(({ url }) => url === "/api/preferences"));
  } finally { globalThis.fetch = previousFetch; delete globalThis.__keyboardEditor; }
});
