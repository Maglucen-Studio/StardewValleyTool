import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("fishing snapshot respects spawn access, skill and uncertain restrictions", () => {
  const result = spawnSync(process.env.PYTHON || "python", [
    fileURLToPath(new URL("./fishing_snapshot_test.py", import.meta.url)),
  ], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
