import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

async function moduleUrl(name, imports = {}) {
  const source = await readFile(new URL(`../app/dashboard/${name}.ts`, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  for (const [path, url] of Object.entries(imports)) outputText = outputText.replace(JSON.stringify(path), JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}

test("LIVE machines group by qualified identity across labels and never alias namespaces", async () => {
  const identity = await moduleUrl("identity");
  const { summarizeLiveMachines } = await import(await moduleUrl("machine-selectors", { "./identity": identity }));
  const live = (id, name, ready = false) => ({ id, name, ready, processing: false, location: "Farm" });
  const result = summarizeLiveMachines([
    live("(BC)12", "Keg", true), live("(BC)12", "Barril"),
    live("(BC)Example", "Keg"), live("(O)12", "Keg"), live(undefined, "Keg"),
  ], [{ id: "12", name: "Keg", displayName: "Barril" }]);
  assert.equal(result.length, 4);
  const keg = result.find((machine) => machine.id === "(BC)12");
  assert.equal(keg.count, 2);
  assert.equal(keg.ready, 1);
  assert.equal(keg.idle, 1);
  assert.equal(keg.displayName, "Barril");
  assert.equal(result.find((machine) => !machine.id).count, 1);
});

test("inventory artwork reconciliation tolerates translated names but requires an exact identity", async () => {
  const { sameInventoryIdentity } = await import(await moduleUrl("identity"));
  assert.equal(sameInventoryIdentity({ id: "(O)12", name: "English" }, { id: "12", name: "Español", spriteKind: "object" }), true);
  assert.equal(sameInventoryIdentity({ id: "(BC)12" }, { id: "(O)12" }), false);
  assert.equal(sameInventoryIdentity({ id: "" }, { id: "" }), false);
});

test("machine products group translated aliases by ID and isolate anonymous legacy outputs", async () => {
  const identity = await moduleUrl("identity");
  const { summarizeLiveMachines } = await import(await moduleUrl("machine-selectors", { "./identity": identity }));
  const machine = (outputId, output) => ({ id: "(BC)12", name: "Machine", ready: true, processing: false, location: "Farm", outputId, output });
  const [result] = summarizeLiveMachines([
    machine("(O)Example", "Product"), machine("(O)Example", "Producto"),
    machine("(BC)Example", "Product"), machine(undefined, "Product"),
    { ...machine("(O)Example", "Product A"), outputVariant: "FruitA" },
    { ...machine("(O)Example", "Product B"), outputVariant: "FruitB" },
  ]);
  assert.equal(result.readyOutputs.length, 5);
  assert.equal(result.readyOutputs.find((item) => item.id === "(O)Example" && !item.variant).count, 2);
  assert.equal(result.readyOutputs.find((item) => item.variant === "(O)FruitA").count, 1);
  assert.equal(result.readyOutputs.find((item) => !item.id).count, 1);
});

test("save machine grouping preserves namespace and mod identifiers", () => {
  const result = spawnSync(process.env.PYTHON || (process.platform === "win32" ? "python" : "python3"), [fileURLToPath(new URL("./machine_snapshot_identity_test.py", import.meta.url))], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
