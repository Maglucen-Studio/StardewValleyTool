"use client";
import { useState } from "react";
import { useI18n } from "../i18n";

type Point = { x: number; y: number };
export function MapTileControls({ width, height, onInspect, onActivate }: { width: number; height: number; onInspect: (point: Point) => void; onActivate?: (point: Point, position: Point) => void }) {
  const { t } = useI18n();
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const point = { x: Number(x), y: Number(y) };
  const valid = x !== "" && y !== "" && Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
  return <fieldset className="map-tile-controls">
    <legend>{t("accessibility.mapControls")}</legend>
    <label>{t("accessibility.tileX")}<input type="number" min={0} max={width - 1} step={1} value={x} onChange={(event) => setX(event.target.value)} /></label>
    <label>{t("accessibility.tileY")}<input type="number" min={0} max={height - 1} step={1} value={y} onChange={(event) => setY(event.target.value)} /></label>
    <button type="button" disabled={!valid} onClick={() => onInspect(point)}>{t("accessibility.inspect")}</button>
    {onActivate && <button type="button" disabled={!valid} onClick={(event) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      onActivate(point, { x: rect.left, y: rect.bottom });
    }}>{t("accessibility.activate")}</button>}
    <small>{t("accessibility.mapHint")}</small>
  </fieldset>;
}
