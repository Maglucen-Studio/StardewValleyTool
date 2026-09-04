import assert from "node:assert/strict";
import test from "node:test";

import { estimateRouteMinutes, normalizeRouteProfile, orderRouteStops } from "../app/route-planner.mjs";

const stops = ["Beach", "Town", "Farm", "Mountain", "Custom Lagoon"].map(location => ({ location }));

test("route profiles prioritize intent without dropping unknown modded stops", () => {
  assert.deepEqual(orderRouteStops(stops, "income").map(stop => stop.location), ["Farm", "Beach", "Town", "Mountain", "Custom Lagoon"]);
  assert.deepEqual(orderRouteStops(stops, "social").map(stop => stop.location), ["Town", "Beach", "Mountain", "Farm", "Custom Lagoon"]);
  assert.deepEqual(orderRouteStops(stops, "mining").map(stop => stop.location), ["Farm", "Mountain", "Town", "Beach", "Custom Lagoon"]);
});

test("fastest routes begin at the current LIVE location when it is actionable", () => {
  assert.equal(orderRouteStops(stops, "fastest", "Beach")[0].location, "Beach");
  assert.equal(normalizeRouteProfile("invented"), "fastest");
});

test("route estimates expose transport savings and a slower relaxed pace", () => {
  const walking = estimateRouteMinutes(5);
  assert.ok(estimateRouteMinutes(5, { horse: true, minecarts: true }) < walking);
  assert.ok(estimateRouteMinutes(5, {}, "relaxed") > walking);
});
