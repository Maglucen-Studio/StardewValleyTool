"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { calculateMushroomLogPlan, calculateTappedTreePlan, type MushroomSpecies } from "./forestry-engine.mjs";
import type { ProductionCatalog } from "./production-calculator";

const OUTPUT_KEYS: Record<string, "common" | "red" | "purple" | "morel" | "chanterelle"> = {
  "(O)404": "common", "(O)420": "red", "(O)422": "purple", "(O)257": "morel", "(O)281": "chanterelle",
};

export function ForestryCalculator({ catalog, resolveGameName, renderProducerArtwork }: { catalog?: ProductionCatalog; resolveGameName: (name: string, id?: string) => string; renderProducerArtwork?: (id: string, name: string, spriteIndex?: number) => ReactNode }) {
  const { t, number } = useI18n();
  const trees = useMemo(() => (catalog?.tappedTrees || []).filter(tree => tree.tapItems.length === 1 && tree.tapItems[0].item && !tree.tapItems[0].condition && !tree.tapItems[0].season && !tree.tapItems[0].hasTimeModifiers), [catalog]);
  const [kind, setKind] = useState<"tree" | "log">("tree");
  const [treeId, setTreeId] = useState("");
  const [count, setCount] = useState(1);
  const [days, setDays] = useState(28);
  const [existing, setExisting] = useState(true);
  const [heavy, setHeavy] = useState(false);
  const [fertilized, setFertilized] = useState(false);
  const [species, setSpecies] = useState<MushroomSpecies>({ oak: 2, maple: 2, pine: 2, mystic: 0, other: 0 });
  const [mossy, setMossy] = useState(0);
  const producerMenu = useRef<HTMLDetailsElement>(null);
  const selected = trees.find(tree => tree.id === treeId) || trees[0];
  const tapper = catalog?.forestryEquipment?.find(item => item.id === (heavy ? "(BC)264" : "(BC)105"));
  const log = catalog?.forestryEquipment?.find(item => item.id === "(BC)MushroomLog");
  const prices = useMemo(() => Object.fromEntries((catalog?.mushroomLogOutputs || []).map(item => [OUTPUT_KEYS[item.id], item.price]).filter(([key]) => key)), [catalog?.mushroomLogOutputs]);
  const result = kind === "log"
    ? calculateMushroomLogPlan({ count, days, existing, equipmentCost: log?.opportunityCost || 0, mossy, species, prices })
    : selected ? calculateTappedTreePlan({ count, days, existing, heavy, growthChance: fertilized ? selected.fertilizedGrowthChance : selected.growthChance, cycleDays: selected.tapItems[0].daysUntilReady, seedCost: selected.seed.price, equipmentCost: tapper?.opportunityCost || 0, outputPrice: selected.tapItems[0].item?.price || 0 }) : null;
  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (producerMenu.current && !producerMenu.current.contains(event.target as Node)) producerMenu.current.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  if (!trees.length || !result) return null;
  const equipment = kind === "log" ? log : tapper;
  const outputName = kind === "log" ? t("forestry.mushroomOutput") : resolveGameName(selected.tapItems[0].item?.name || "", selected.tapItems[0].itemId);
  const producerName = kind === "log" ? resolveGameName(log?.name || "", log?.id) : outputName;
  const producerId = kind === "log" ? log?.id || "(BC)MushroomLog" : selected.tapItems[0].itemId;
  const producerSpriteIndex = kind === "log" ? log?.spriteIndex : selected.tapItems[0].item?.spriteIndex;
  const gold = (value: number) => t("planner.gold", { amount: number(value) });
  const setSpeciesCount = (key: keyof MushroomSpecies, value: number) => setSpecies(current => ({ ...current, [key]: Math.max(0, Math.floor(value || 0)) }));

  return <section className="production-calculator forestry-calculator">
    <div className="crop-section-title"><div><p className="eyebrow">{t("forestry.eyebrow")}</p><h2>{t("forestry.title")}</h2><p>{t("forestry.description")}</p></div></div>
    <div className="planner-quick-grid">
      <div className="planner-field"><label>{t("forestry.producer")}</label><details className="planner-producer-menu" ref={producerMenu}>
        <summary>{renderProducerArtwork?.(producerId, producerName, producerSpriteIndex)}<span><strong>{producerName}</strong></span></summary>
        <div className="planner-producer-options"><section><h4>{t("forestry.producerOptions")}</h4>
          {trees.map(tree => { const name = resolveGameName(tree.tapItems[0].item?.name || "", tree.tapItems[0].itemId); return <button type="button" className={kind === "tree" && tree.id === selected.id ? "active" : ""} onClick={() => { setKind("tree"); setTreeId(tree.id); producerMenu.current?.removeAttribute("open"); }} key={tree.id}>{renderProducerArtwork?.(tree.tapItems[0].itemId, name, tree.tapItems[0].item?.spriteIndex)}<span><strong>{name}</strong></span></button>; })}
          {log && <button type="button" className={kind === "log" ? "active" : ""} onClick={() => { setKind("log"); producerMenu.current?.removeAttribute("open"); }}>{renderProducerArtwork?.(log.id, resolveGameName(log.name, log.id), log.spriteIndex)}<span><strong>{resolveGameName(log.name, log.id)}</strong></span></button>}
        </section></div>
      </details></div>
      <label>{t("forestry.count")}<input type="number" min="1" value={count} onChange={event => setCount(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></label>
      <label>{t("planner.durationDays")}<input type="number" min="1" value={days} onChange={event => setDays(Math.max(1, Math.floor(Number(event.target.value) || 1)))} /></label>
    </div>
    <div className="forestry-options">
      <label className="planner-check"><input type="checkbox" checked={existing} onChange={event => setExisting(event.target.checked)} /><span>{t("forestry.existing")}</span></label>
      {kind === "tree" ? <>
        <label className="planner-check"><input type="checkbox" checked={heavy} onChange={event => setHeavy(event.target.checked)} /><span>{t("forestry.heavy")}</span></label>
        {!existing && <label className="planner-check"><input type="checkbox" checked={fertilized} onChange={event => setFertilized(event.target.checked)} /><span>{t("forestry.treeFertilizer")}</span></label>}
      </> : <fieldset><legend>{t("forestry.nearbySpecies")}</legend><div className="forestry-species-grid">
        {(["oak", "maple", "pine", "mystic", "other"] as const).map(key => <label key={key}>{t(`forestry.${key}`)}<input type="number" min="0" value={species[key]} onChange={event => setSpeciesCount(key, Number(event.target.value))} /></label>)}
        <label>{t("forestry.mossy")}<input type="number" min="0" max={result.nearbyTrees} value={mossy} onChange={event => setMossy(Math.max(0, Math.min(result.nearbyTrees, Math.floor(Number(event.target.value) || 0))))} /></label>
      </div></fieldset>}
    </div>
    <div className="planner-results"><div className="planner-result-head"><div className="planner-result-identity">{renderProducerArtwork?.(producerId, producerName, producerSpriteIndex)}<div><p className="eyebrow">{t("planner.result")}</p><h3>{outputName}</h3></div></div><strong>{gold(result.profit)}<small>{t("planner.netProfit")}</small></strong></div>
      <dl className="planner-metrics">
        <div><dt>{t("forestry.cycles")}</dt><dd>{number(result.cycles)}</dd></div>
        <div><dt>{t("forestry.outputUnits")}</dt><dd>{number(Math.round(result.units * 10) / 10)}</dd></div>
        <div><dt>{t("planner.totalCosts")}</dt><dd>{gold(result.cost)}</dd></div>
        <div><dt>{t("planner.grossRevenue")}</dt><dd>{gold(result.gross)}</dd></div>
        <div><dt>{t("planner.profitPerDay")}</dt><dd>{gold(Math.round(result.profit / days))}</dd></div>
        <div><dt>{t("planner.breakEven")}</dt><dd>{result.breaksEvenInRange ? t("planner.bookmark.days", { count: number(result.breakEvenDays) }) : t("forestry.notWithinPeriod")}</dd></div>
        {"growthDelay" in result && result.growthDelay > 0 && <div><dt>{t("forestry.growthDelay")}</dt><dd>{t("planner.bookmark.days", { count: number(result.growthDelay) })}</dd></div>}
        {"qualityChance" in result && <div><dt>{t("forestry.qualityBonus")}</dt><dd>{t("forestry.qualityValue", { chance: number(Math.round(result.qualityChance * 100)), multiplier: number(Math.round((result.qualityMultiplier - 1) * 100)) })}</dd></div>}
      </dl>
      {!existing && equipment?.materials?.length ? <div className="forestry-materials"><strong>{t("forestry.materials")}</strong><span>{equipment.materials.map(({ item, quantity }) => `${number(count * quantity)}× ${resolveGameName(item.name, item.id)}`).join(" · ")}{kind === "tree" ? ` · ${number(count)}× ${resolveGameName(selected.seed.name, selected.seed.id)}` : ""}</span></div> : null}
      <ul className="planner-warnings"><li>{kind === "log" ? t("forestry.logUncertainty") : t("forestry.treeUncertainty")}</li></ul>
    </div>
  </section>;
}
