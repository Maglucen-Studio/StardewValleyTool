import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { JSDOM } from "jsdom";
import axe from "axe-core";

// This fixture is invented, never derived from a player's save or local game assets.
const fixture = JSON.parse(await readFile(new URL("./fixtures/accessibility-farm.json", import.meta.url), "utf8"));

test("major rendered dashboard views expose accessible names and valid semantics", async (context) => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom", esbuild: { jsx: "automatic" }, logLevel: "error" });
  const current = structuredClone(fixture);
  current.fishingBrief.fish = [{ id: "synthetic-fish", name: "Synthetic fish", difficulty: 20, behavior: "mixed", windows: [[600, 2400]], seasons: ["spring"], weather: "both", locations: ["Ocean"], accessibleLocations: ["Ocean"], basePrice: 10, minFishingLevel: 0, caught: false }];
  current.achievements.items = [{ id: "synthetic", name: "Synthetic achievement", requirement: "Collect a synthetic item", category: "collection", done: false, current: 0, target: 1, unit: "items" }];
  current.achievements.total = 1;
  const cases = [
    ["today-view", "DailyBriefView", {}],
    ["farm-editor-view", "FarmEditorView", { data: current, activeView: "map", base: null }],
    ["planning-view", "PlanningView", { mode: "farm" }],
    ["fishing-view", "FishingView", {}],
    ["planning-view", "PlanningView", { mode: "plan" }],
    ["progress-view", "GrowthView", {}],
    ["progress-view", "AchievementsView", {}],
    ["artwork", "GoalRequirements", { target: { id: "synthetic", requirements: [{ id: "(O)synthetic", name: "Synthetic resource", required: 4, available: 1 }] } }],
    ["map-tile-controls", "MapTileControls", { width: 80, height: 65, onInspect() {}, onActivate() {} }],
  ];
  try {
    for (const [file, name, extra] of cases) await context.test(`${name} ${extra.mode || ""}`, async () => {
      const viewModule = await server.ssrLoadModule(`/app/dashboard/${file}.tsx`);
      const html = renderToStaticMarkup(React.createElement(viewModule[name], { current, history: { profileId: "synthetic", entries: [1, 2].map((day) => ({ ...current, day, dateKey: `synthetic-${day}`, dayIndex: day, income: 20, spending: 10, money: 20 * day, totalMoneyEarned: 40 * day, buildings: 0, trees: 0, crops: 0 })) }, previous: null, live: { active: false }, sprites: {}, sessionBaseline: null, onOpenCommunityCenter() {}, ...extra }));
      const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Accessibility test</title></head><body><main>${html}</main></body></html>`, { runScripts: "outside-only" });
      try {
        dom.window.eval(axe.source);
        // JSDOM has no layout/paint engine. Contrast, clipping and native focus
        // containment are verified separately in the manual browser checklist.
        const result = await dom.window.axe.run(dom.window.document, { rules: { "color-contrast": { enabled: false } } });
        assert.equal(result.violations.length, 0, JSON.stringify(result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ html, failureSummary }) => ({ html, failureSummary })) })), null, 2));
        assert.equal(dom.window.document.querySelectorAll("button button").length, 0);
      } finally { dom.window.close(); }
    });
  } finally { await server.close(); }
});
