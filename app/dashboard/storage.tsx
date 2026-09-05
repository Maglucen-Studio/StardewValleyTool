"use client";
import { AccessibleDialog } from "./accessible-dialog";

import { useI18n } from "../i18n";
import { useRef } from "react";
import { useEffect } from "react";
import { furnitureDestination } from "../furniture-layout.mjs";
import { type StorageSourceDetail, type Snapshot, type LiveState, type FarmObject, type Building, type Interior, type StorageInventoryItem } from "./snapshot-types";
import { type Translate } from "./ui-types";
import { localizedInteriorName } from "./formatting";
import { TILE, sprite, cropSpriteSource, drawBuildingSprite } from "./farm-rendering";
import { StorageArtwork, ItemMentionArtwork, StorageContainerArtwork } from "./artwork";
import { WikiLink } from "./ui";

export function completeStorageSourceDetail(detail: StorageSourceDetail | undefined) {
  if (!detail || detail.kind !== "chest") return detail;
  const legacy = /^Chest · (.+?) \((-?\d+),\s*(-?\d+)\)$/.exec(detail.source);
  if (!legacy) return detail;
  return {
    ...detail,
    location: detail.location || legacy[1],
    x: detail.x ?? Number(legacy[2]),
    y: detail.y ?? Number(legacy[3]),
  };
}

export function readableStorageLocation(detail: StorageSourceDetail | undefined, current: Snapshot, t: Translate) {
  detail = completeStorageSourceDetail(detail);
  const raw = detail?.location || "";
  if (!raw) return t("storage.unknownLocation");
  if (raw === "Farm") return t("nav.farm");
  const interior = current.interiors.find((entry) => entry.id === raw)
    || current.interiors.find((entry) => entry.name === raw && entry.background)
    || current.interiors.find((entry) => entry.name === raw);
  if (interior) {
    const exterior = /-(\d+)-(\d+)$/.exec(interior.id);
    return exterior
      ? `${localizedInteriorName(interior, t)} · ${t("nav.farm")} (${exterior[1]}, ${exterior[2]})`
      : localizedInteriorName(interior, t);
  }
  return raw
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "")
    .replace(/[_-]+$/, "") || raw;
}

export function readableStorageSource(
  source: string,
  detail: StorageSourceDetail | undefined,
  current: Snapshot,
  t: Translate,
) {
  detail = completeStorageSourceDetail(detail);
  if (detail?.kind !== "chest") return source;
  const tile = typeof detail.x === "number" && typeof detail.y === "number"
    ? ` · tile ${detail.x}, ${detail.y}`
    : "";
  return `${t("storage.chest")} · ${readableStorageLocation(detail, current, t)}${tile}`;
}

export function StorageLocationPreview({
  detail,
  current,
  live,
  sprites,
}: {
  detail?: StorageSourceDetail;
  current: Snapshot;
  live: LiveState;
  sprites: Record<string, HTMLImageElement>;
}) {
  detail = completeStorageSourceDetail(detail);
  if (
    !detail ||
    detail.kind !== "chest" ||
    typeof detail.x !== "number" ||
    typeof detail.y !== "number"
  ) return null;
  return (
    <StorageLocationPreviewCanvas
      detail={detail as StorageSourceDetail & { kind: "chest"; x: number; y: number }}
      current={current}
      live={live}
      sprites={sprites}
    />
  );
}

export function StorageLocationPreviewCanvas({
  detail,
  current,
  live,
  sprites,
}: {
  detail: StorageSourceDetail & { kind: "chest"; x: number; y: number };
  current: Snapshot;
  live: LiveState;
  sprites: Record<string, HTMLImageElement>;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const rawLocation = detail.location || "";
  const legacyLocation = rawLocation.split("_")[0];
  const normalizedLocation = rawLocation === "Farm" ? "Farm" : rawLocation;
  const interior = current.interiors.find((entry) => entry.id === rawLocation)
    || current.interiors.find((entry) => entry.name === rawLocation && entry.background)
    || current.interiors.find((entry) => entry.name === rawLocation)
    || current.interiors.find((entry) => entry.id === legacyLocation)
    || current.interiors.find(
      (entry) => entry.name === legacyLocation && entry.background,
    )
    || current.interiors.find((entry) => entry.name === legacyLocation);
  const extractedLocation = current.locationMaps?.[rawLocation]
    || current.locationMaps?.[legacyLocation];
  const background = normalizedLocation === "Farm"
    ? current.locationMaps?.Farm?.background
    : interior?.background || extractedLocation?.background;
  const foreground = normalizedLocation === "Farm"
    ? undefined
    : interior?.foreground || extractedLocation?.foreground;
  const mapWidth = normalizedLocation === "Farm"
    ? current.map.width
    : interior?.width || extractedLocation?.width;
  const mapHeight = normalizedLocation === "Farm"
    ? current.map.height
    : interior?.height || extractedLocation?.height;
  const safeMapWidth = mapWidth || 1;
  const safeMapHeight = mapHeight || 1;
  const frameWidth = Math.min(16, safeMapWidth);
  const frameHeight = Math.min(10, safeMapHeight);
  const startX = Math.max(0, Math.min(safeMapWidth - frameWidth, detail.x - Math.floor(frameWidth / 2)));
  const startY = Math.max(0, Math.min(safeMapHeight - frameHeight, detail.y - Math.floor(frameHeight / 2)));

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    ctx.clearRect(0, 0, element.width, element.height);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(-startX * TILE, -startY * TILE);

    const tintCraftable = (
      index: number,
      x: number,
      y: number,
      color?: string | null,
    ) => {
      const sheet = sprites.craftables;
      if (!sheet) return;
      const source: [number, number, number, number] = [
        (index % 8) * 16,
        Math.floor(index / 8) * 32,
        16,
        32,
      ];
      sprite(ctx, sheet, source, [x, y - TILE]);
      if (!color) return;
      const tinted = document.createElement("canvas");
      tinted.width = 16;
      tinted.height = 32;
      const tint = tinted.getContext("2d");
      if (!tint) return;
      tint.imageSmoothingEnabled = false;
      tint.drawImage(sheet, ...source, 0, 0, 16, 32);
      tint.globalCompositeOperation = "source-atop";
      tint.globalAlpha = 0.72;
      tint.fillStyle = color;
      tint.fillRect(0, 0, 16, 32);
      tint.globalAlpha = 0.32;
      tint.drawImage(sheet, ...source, 0, 0, 16, 32);
      ctx.drawImage(tinted, x, y - TILE);
    };

    const chestColors = new Map<string, string | null>();
    for (const item of current.planningBrief.inventory)
      for (const source of item.sourceDetails || [])
        if (
          source.kind === "chest" &&
          source.location &&
          typeof source.x === "number" &&
          typeof source.y === "number"
        ) chestColors.set(`${source.location}:${source.x}:${source.y}`, source.color || null);

    if (normalizedLocation === "Farm") {
      for (const feature of current.terrain) {
        const px = feature.x * TILE;
        const py = feature.y * TILE;
        if (feature.kind === "Grass" && sprites.grass) {
          sprite(ctx, sprites.grass, [0, 0, 15, 20], [px, py - 4]);
        } else if (feature.kind === "Tree") {
          const tree = sprites[feature.treeType || "Oak"] || sprites.Oak;
          if (!tree) continue;
          const stage = feature.stage || 0;
          if (feature.stump && stage >= 5)
            sprite(ctx, tree, [16, 96, 32, 32], [px - 8, py - 16]);
          else if (stage >= 5)
            sprite(ctx, tree, [0, 0, 48, 96], [px - 16, py - 80]);
          else if (stage === 4)
            sprite(ctx, tree, [0, 96, 16, 32], [px, py - 16]);
          else
            sprite(ctx, tree, [stage === 0 ? 48 : stage === 1 ? 0 : 16, 128, 16, 16], [px, py]);
        } else if (feature.kind === "HoeDirt" && sprites.hoeDirt) {
          sprite(ctx, sprites.hoeDirt, [0, feature.watered ? 16 : 0, 16, 16], [px, py]);
          if (feature.crop && sprites.crops)
            sprite(ctx, sprites.crops, cropSpriteSource(feature.cropRow || 0, feature.phase || 0), [px, py - 16]);
        }
      }
    }

    const objects = normalizedLocation === "Farm"
      ? live.active && live.farmMap?.objects
        ? live.farmMap.objects
        : current.objects
      : interior?.objects || [];
    const buildings = normalizedLocation === "Farm"
      ? live.active && live.farmMap?.buildings
        ? live.farmMap.buildings
        : current.buildings
      : [];
    const furniture = interior?.furniture || [];
    const entities: Array<
      | { type: "object"; bottom: number; item: FarmObject }
      | { type: "building"; bottom: number; item: Building }
      | { type: "furniture"; bottom: number; item: Interior["furniture"][number] }
    > = [
      ...objects.map((item) => ({ type: "object" as const, bottom: item.y + 1, item })),
      ...buildings.map((item) => ({ type: "building" as const, bottom: item.y + item.height, item })),
      ...furniture.map((item) => ({ type: "furniture" as const, bottom: item.y + 1, item })),
    ].sort((a, b) => a.bottom - b.bottom);

    for (const entity of entities) {
      if (entity.type === "building") {
        drawBuildingSprite(ctx, sprites, entity.item);
        continue;
      }
      if (entity.type === "furniture") {
        const item = entity.item;
        if (item.sourceWidth && item.sourceHeight && sprites.furniture)
          sprite(
            ctx,
            sprites.furniture,
            [item.sourceX || 0, item.sourceY || 0, item.sourceWidth, item.sourceHeight],
            furnitureDestination(item, TILE),
          );
        continue;
      }
      const item = entity.item;
      const px = item.x * TILE;
      const py = item.y * TILE;
      const index = Number(item.id);
      if (!Number.isFinite(index)) continue;
      const color = item.color || chestColors.get(`${normalizedLocation}:${item.x}:${item.y}`);
      if (item.big) tintCraftable(index, px, py, color);
      else if (sprites.objects)
        sprite(ctx, sprites.objects, [(index % 24) * 16, Math.floor(index / 24) * 16, 16, 16], [px, py]);
    }

    if (!objects.some((item) => item.x === detail.x && item.y === detail.y)) {
      const chestIndex = Number(String(detail.itemId || "130").replace(/^\(BC\)/, ""));
      if (Number.isFinite(chestIndex))
        tintCraftable(
          chestIndex,
          detail.x * TILE,
          detail.y * TILE,
          detail.color,
        );
    }

    ctx.restore();
    const targetX = (detail.x - startX) * TILE;
    const targetY = (detail.y - startY) * TILE;
    ctx.strokeStyle = "#ffe36e";
    ctx.lineWidth = 2;
    ctx.strokeRect(targetX + 1, targetY + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "#243b2c";
    ctx.lineWidth = 1;
    ctx.strokeRect(targetX + 3, targetY + 3, TILE - 6, TILE - 6);
  }, [current, detail, interior, live, normalizedLocation, sprites, startX, startY]);

  if (!background || !mapWidth || !mapHeight) return null;
  return (
    <span
      className="storage-location-preview"
      title={t("storage.locationTile", { location: detail.location || "", x: detail.x, y: detail.y })}
      style={{
        width: frameWidth * 12,
        height: frameHeight * 12,
        backgroundImage: `url("${background}")`,
        backgroundSize: `${mapWidth * 12}px ${mapHeight * 12}px`,
        backgroundPosition: `${-startX * 12}px ${-startY * 12}px`,
      }}
      aria-hidden="true"
    >
      <canvas ref={canvas} width={frameWidth * TILE} height={frameHeight * TILE} />
      {foreground ? (
        <span
          className="storage-location-preview-foreground"
          style={{
            backgroundImage: `url("${foreground}")`,
            backgroundSize: `${mapWidth * 12}px ${mapHeight * 12}px`,
            backgroundPosition: `${-startX * 12}px ${-startY * 12}px`,
          }}
        />
      ) : null}
    </span>
  );
}

export function ItemLocationDialog({
  name,
  item,
  current,
  live,
  sprites,
  onClose,
}: {
  name: string;
  item?: StorageInventoryItem;
  current: Snapshot;
  live: LiveState;
  sprites: Record<string, HTMLImageElement>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const rawEntries = (item?.sourceCounts?.length
    ? item.sourceCounts
    : (item?.sources || []).map((source) => ({
        source,
        count: item?.count || 0,
        quality: item?.quality || 0,
      })))
    .map((entry, index) => ({
      ...entry,
      quality: entry.quality ?? item?.quality ?? 0,
      detail: item?.sourceDetails?.find((detail) => detail.source === entry.source)
        || item?.sourceDetails?.[index],
    }));
  const entries = Array.from(
    rawEntries.reduce<
      Map<
        string,
        {
          source: string;
          count: number;
          detail?: StorageSourceDetail;
          stacks: { quality: number; count: number }[];
        }
      >
    >((grouped, entry) => {
      const existing = grouped.get(entry.source) || {
        source: entry.source,
        count: 0,
        detail: entry.detail,
        stacks: [],
      };
      existing.count += entry.count;
      const stack = existing.stacks.find(
        (candidate) => candidate.quality === entry.quality,
      );
      if (stack) stack.count += entry.count;
      else existing.stacks.push({ quality: entry.quality, count: entry.count });
      grouped.set(entry.source, existing);
      return grouped;
    }, new Map()).values(),
  );
  return (
    <div className="item-locator-backdrop" onPointerDown={onClose}>
      <AccessibleDialog
        className="item-locator-dialog"
            onDismiss={onClose}
        aria-label={t("storage.whereStored", { name })}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="help-close" onClick={onClose} aria-label={t("today.brief.close")}>×</button>
        <p className="eyebrow">{t("web.itemLocationDialog.storageLocation")}</p>
        <header>
          {item ? <StorageArtwork item={item} /> : <ItemMentionArtwork name={name} locatable={false} />}
          <div>
            <h2>{name}</h2>
            <span>{item ? t("storage.availableCount", { count: item.count }) : t("storage.notFoundLatest")}</span>
            <WikiLink name={name} />
          </div>
        </header>
        {entries.length > 0 ? (
          <div className="item-locator-sources">
            {entries.map((entry) => (
              <article key={entry.source}>
                <div className="item-locator-source-title">
                  <StorageContainerArtwork detail={entry.detail} />
                  <span>
                    <strong>{entry.source}</strong>
                    <small>{entry.count}{t("web.itemLocationDialog.here")}</small>
                    <span className="item-locator-quality-list">
                      {entry.stacks
                        .sort((a, b) => a.quality - b.quality)
                        .map((stack) => {
                          const quality = stack.quality >= 4
                            ? "iridium"
                            : stack.quality === 2
                              ? "gold"
                              : stack.quality === 1
                                ? "silver"
                                : "normal";
                          return (
                            <span key={stack.quality} title={t("storage.qualityNamed", { quality: t(`quality.${quality}`) })}>
                              <i className={quality} aria-hidden="true">
                                {quality === "normal" ? "—" : "★"}
                              </i>
                              {stack.count} {t(`quality.${quality}`)}
                            </span>
                          );
                        })}
                    </span>
                  </span>
                </div>
                <StorageLocationPreview
                  detail={entry.detail}
                  current={current}
                  live={live}
                  sprites={sprites}
                />
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-daily">{t("web.itemLocationDialog.itMayHaveBeenMovedSinceTheLatestSave")}</p>
        )}
        <small className="item-locator-hint">{t("web.itemLocationDialog.clickItemCardsAnywhereInTheAppToOpen")}</small>
      </AccessibleDialog>
    </div>
  );
}
