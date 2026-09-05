"use client";
import { formatNumber } from "./formatting";

import { createContext } from "react";
import { useI18n } from "../i18n";
import type { ProductionAnimal } from "../planning/production-calculator";
import { useContext } from "react";
import type { CSSProperties } from "react";
import { type ItemArtwork, type ItemSpriteKind, type StorageSourceDetail, type CommunityRoom, type GiftItem, type LiveState } from "./snapshot-types";
import { spritePaths } from "./farm-rendering";
import { type StrategicGoalTarget } from "./ui-types";
import { communityRoomName, localizedStorageSource } from "./formatting";

export const ItemArtworkCatalogContext = createContext<Record<string, ItemArtwork>>({});

export const itemArtworkKey = (name: string) =>
  name.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");

export const legacyCraftableSpriteIndex: Record<string, number> = {
  "Lightning Rod": 9,
  "Bee House": 10,
  Keg: 12,
  Furnace: 13,
  "Preserves Jar": 15,
  "Cheese Press": 16,
  Loom: 17,
  "Oil Maker": 19,
  "Recycling Machine": 20,
  Crystalarium: 21,
  "Mayonnaise Machine": 24,
  "Seed Maker": 25,
  Tapper: 105,
  "Charcoal Kiln": 114,
  "Worm Bin": 154,
  Cask: 163,
};

export const modernObjectSpriteIndex: Record<string, number> = {
  Carrot: 80,
  SummerSquash: 81,
  "Summer Squash": 81,
  Broccoli: 82,
  Powdermelon: 83,
};

export function SheetArtwork({
  id,
  kind,
  label,
  className = "",
  sourceWidth = 1,
  sourceHeight = 1,
  fit = false,
}: {
  id?: string;
  kind: Exclude<ItemSpriteKind, "fallback">;
  label: string;
  className?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  fit?: boolean;
}) {
  const { t } = useI18n();
  const raw = String(id || "").replace(/^\([A-Z]+\)/, "");
  const parsed = raw === "" ? Number.NaN : Number(raw);
  const modernIndex =
    kind === "object"
      ? modernObjectSpriteIndex[raw] ?? modernObjectSpriteIndex[label]
      : undefined;
  const resolvedKind = modernIndex === undefined ? kind : "object2";
  let index = parsed;
  if (!Number.isFinite(index)) {
    index =
      modernIndex ??
      (resolvedKind === "craftable"
        ? legacyCraftableSpriteIndex[label]
        : Number.NaN);
  }
  if (!Number.isFinite(index))
    return (
      <span
        className={`sheet-artwork missing ${resolvedKind} ${className}`}
        title={t("artwork.spriteUnavailable", { name: label })}
        aria-hidden="true"
      >
        {label.slice(0, 1)}
      </span>
    );
  const sheets = {
    object: { path: spritePaths.objects, columns: 24, width: 16, height: 16, row: 16, scale: 2 },
    object2: { path: spritePaths.objects2, columns: 8, width: 16, height: 16, row: 16, scale: 2 },
    craftable: { path: spritePaths.craftables, columns: 8, width: 16, height: 32, row: 32, scale: 2 },
    furniture: { path: spritePaths.furniture, columns: 32, width: 16, height: 16, row: 16, scale: 2 },
    weapon: { path: spritePaths.weapons, columns: 8, width: 16, height: 16, row: 16, scale: 2 },
    // Tool indices address a 16px-high grid. Tall tools opt into two source
    // tiles through sourceHeight, while fishing rods use a single square tile.
    tool: { path: spritePaths.tools, columns: 21, width: 16, height: 16, row: 16, scale: 2 },
    hat: { path: spritePaths.hats, columns: 12, width: 20, height: 20, row: 80, scale: 1.6 },
    shirt: { path: spritePaths.shirts, columns: 16, width: 8, height: 8, row: 32, scale: 4 },
  } as const;
  const sheet = sheets[resolvedKind];
  const scale = fit
    ? Math.min(
        sheet.scale,
        32 / (sheet.width * Math.max(1, sourceWidth)),
        32 / (sheet.height * Math.max(1, sourceHeight)),
      )
    : sheet.scale;
  const renderedWidth = sheet.width * Math.max(1, sourceWidth) * scale;
  const renderedHeight =
    sheet.height *
    Math.max(1, sourceHeight) *
    scale;
  const fitLeft = fit ? Math.max(0, (32 - renderedWidth) / 2) : 0;
  const fitTop = fit ? Math.max(0, (32 - renderedHeight) / 2) : 0;
  const left = -(index % sheet.columns) * sheet.width * scale;
  const top = -Math.floor(index / sheet.columns) * sheet.row * scale;
  return (
    <span
      className={`sheet-artwork ${resolvedKind} ${className}`}
      title={label}
      aria-hidden="true"
      style={fit ? { width: 32, height: 32 } : undefined}
    >
      <span
        className="sheet-artwork-crop"
        style={{
          left: fitLeft,
          top: fitTop,
          width: renderedWidth,
          height: renderedHeight,
        }}
      >
        {/* Local spritesheets retain their original pixel grid and must not be optimized. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sheet.path}
          alt=""
          style={{
            left: `${left}px`,
            top: `${top}px`,
            transform: `scale(${scale})`,
          }}
          onError={(event) => {
            event.currentTarget.hidden = true;
            event.currentTarget.closest(".sheet-artwork")?.classList.add("missing");
          }}
        />
      </span>
    </span>
  );
}

export function ModdedItemArtwork({ url, label, spriteIndex = 0, columns = 1 }: { url: string; label: string; spriteIndex?: number; columns?: number }) {
  const scale = 2;
  return <span className="sheet-artwork object modded-item-artwork" title={label} aria-hidden="true">
    <span className="modded-item-fallback">{label.slice(0, 1)}</span>
    {/* Content Patcher artwork is copied from the local installation at runtime. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt="" style={{ left: -(spriteIndex % columns) * 16 * scale, top: -Math.floor(spriteIndex / columns) * 16 * scale }} onError={(event) => {
      event.currentTarget.hidden = true;
      event.currentTarget.closest(".sheet-artwork")?.classList.add("missing");
    }} />
  </span>;
}

export function AnimalArtwork({ animal, label }: { animal: ProductionAnimal; label: string }) {
  const width = Math.max(1, Number(animal.spriteWidth) || 16);
  const height = Math.max(1, Number(animal.spriteHeight) || 16);
  const scale = Math.min(2, 38 / Math.max(width, height));
  if (!animal.artworkUrl) return <span className="animal-artwork missing" title={label} aria-hidden="true">{label.slice(0, 1)}</span>;
  return <span className="animal-artwork" title={label} aria-hidden="true">
    <span className="animal-artwork-frame" style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}>
      {/* Farm-animal textures are extracted at runtime from the user's local game. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={animal.artworkUrl} alt="" onError={(event) => {
        event.currentTarget.hidden = true;
        event.currentTarget.closest(".animal-artwork")?.classList.add("missing");
      }} />
    </span>
  </span>;
}

export function StorageArtwork({ item }: { item: ItemArtwork }) {
  const label = item.displayName || item.name;
  const qualifier = /^\(([A-Z]+)\)/.exec(item.id)?.[1];
  const qualifiedKind: ItemSpriteKind | undefined = {
    O: "object",
    BC: "craftable",
    F: "furniture",
    W: "weapon",
    T: "tool",
    H: "hat",
    S: "shirt",
    B: "object",
    R: "object",
  }[qualifier || ""] as ItemSpriteKind | undefined;
  const kind = item.spriteKind || qualifiedKind;
  const spriteIndex = item.spriteIndex || item.id;
  if (
    kind === "fallback" ||
    (!kind && !Number.isFinite(Number(spriteIndex)))
  ) {
    return <SheetArtwork kind="object" label={label} />;
  }
  return (
    <SheetArtwork
      id={spriteIndex}
      kind={(kind || "object") as Exclude<ItemSpriteKind, "fallback">}
      label={label}
      sourceWidth={item.spriteWidth}
      sourceHeight={item.spriteHeight}
      fit
    />
  );
}

export function ItemMentionArtwork({
  id,
  name,
  item,
  locatable = true,
}: {
  id?: string;
  name: string;
  item?: ItemArtwork;
  locatable?: boolean;
}) {
  const { t } = useI18n();
  const catalog = useContext(ItemArtworkCatalogContext);
  const resolvedItem = item || catalog[itemArtworkKey(name)];
  if (id === "-1" || name === "Gold") {
    return (
      <span
        className="item-mention-artwork money"
        title={t("web.itemMentionArtwork.gold")}
        aria-hidden="true"
      >
        {/* Extracted from the user's local game installation at runtime. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/sprites/gold.png" alt="" width={32} height={32}
          onError={(event) => { event.currentTarget.hidden = true; }} />
        <span className="money-fallback">g</span>
      </span>
    );
  }
  return (
    <span
      className={`item-mention-artwork${locatable ? " locatable" : ""}`}
      data-storage-item={locatable ? name : undefined}
      title={locatable ? t("storage.clickToLocateNamed", { name }) : name}
    >
      {resolvedItem ? (
        <StorageArtwork item={resolvedItem} />
      ) : (
        <SheetArtwork id={id} kind="object" label={name} fit />
      )}
    </span>
  );
}

export function GoalRequirements({
  target,
  compact = false,
}: {
  target: StrategicGoalTarget;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <section className={`goal-requirements${compact ? " compact" : ""}`}>
      <header>
        <strong>{t("web.goalRequirements.resources")}</strong>
        <span>{target.requirementsLabel || t("goal.everythingRequired")}</span>
      </header>
      <ul>
        {target.requirements.map((requirement) => {
          const missing = Math.max(0, requirement.required - requirement.available);
          const satisfied = missing === 0;
          const suffix = requirement.suffix || "";
          return (
            <li
              className={`${satisfied ? "ready" : "missing"} locatable-item-card`}
              data-storage-item={requirement.name}
              title={t("storage.clickToLocateNamed", { name: requirement.name })}
              key={`${target.id}:${requirement.name}`}
            >
              <span className="goal-resource-status" aria-hidden="true">
                {satisfied ? "✓" : "!"}
              </span>
              <ItemMentionArtwork
                id={requirement.id}
                name={requirement.name}
                item={requirement.artwork}
              />
              <span className="goal-resource-name">{requirement.name}</span>
              <span className="goal-resource-count">
                {formatNumber(requirement.available, locale)}{suffix}
                {" / "}
                {formatNumber(requirement.required, locale)}{suffix}
              </span>
              <small>
                {satisfied
                  ? t("common.ready")
                  : t("goal.missingAmount", { amount: `${formatNumber(missing, locale)}${suffix}` })}
              </small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function StorageContainerArtwork({ detail }: { detail?: StorageSourceDetail }) {
  const { t } = useI18n();
  if (!detail || detail.kind === "backpack") {
    return <span className="storage-container-artwork backpack" aria-hidden="true">B</span>;
  }
  const rawIndex = Number(String(detail.itemId || "130").replace(/^\([A-Z]+\)/, ""));
  const spriteIndex = Number.isFinite(rawIndex) ? rawIndex : 130;
  return (
    <span
      className="storage-container-artwork chest"
      title={detail.color ? t("storage.chestColor", { color: detail.color }) : t("storage.defaultWoodChest")}
      aria-hidden="true"
    >
      <span
        className="storage-chest-sprite"
      >
        <i
          className="storage-chest-base"
          style={{
            backgroundImage: `url("${spritePaths.craftables}")`,
            backgroundPosition: `${-(spriteIndex % 8) * 16}px ${-Math.floor(spriteIndex / 8) * 32}px`,
          }}
        />
        {detail.color && (
          <i
            className="storage-chest-tint"
            style={{
              backgroundColor: detail.color,
              maskImage: `url("${spritePaths.craftables}")`,
              maskPosition: `${-(spriteIndex % 8) * 16}px ${-Math.floor(spriteIndex / 8) * 32}px`,
              WebkitMaskImage: `url("${spritePaths.craftables}")`,
              WebkitMaskPosition: `${-(spriteIndex % 8) * 16}px ${-Math.floor(spriteIndex / 8) * 32}px`,
            }}
          />
        )}
      </span>
    </span>
  );
}

export function CommunityRoomArtwork({ room }: { room: CommunityRoom }) {
  const { t } = useI18n();
  const label = communityRoomName(room.id, t);
  const state =
    room.total > 0 && room.completed >= room.total ? "complete" : "ruined";
  return (
    <span
      className="community-room-artwork"
      title={t("community.room.preview", { room: label })}
      aria-hidden="true"
    >
      <b>{label.slice(0, 1)}</b>
      {/* This private room preview is rendered from the user's local Community Center map and tilesheets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/community-rooms/${encodeURIComponent(room.id)}-${state}.png`}
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.parentElement?.classList.add("missing");
        }}
      />
    </span>
  );
}

export function GiftGroup({
  label,
  tone,
  items,
}: {
  label: string;
  tone: string;
  items: GiftItem[];
}) {
  const { t } = useI18n();
  const quality = ["normal", "silver", "gold", "iridium", "iridium"];
  return (
    <div className={`gift-group ${tone}`}>
      <h3>
        {label} <span>{items.length}</span>
      </h3>
      {items.length ? (
        <div className="gift-list">
          {items.map((item, index) => (
            <div
              className="locatable-item-card"
              data-storage-item={item.name}
              title={t("storage.clickToLocate", { item: item.displayName || item.name })}
              key={`${item.name}-${item.quality}-${index}`}
            >
              <ItemMentionArtwork
                id={item.id}
                name={item.name}
                item={item.id ? { ...item, id: item.id } : undefined}
              />
              <strong>{item.displayName || item.name}</strong>
              <span>
                {item.count}× · {t(`quality.${quality[item.quality] || "normal"}`)}
              </span>
              <small>{item.sources.map((source) => localizedStorageSource(source, t)).join(" · ")}</small>
            </div>
          ))}
        </div>
      ) : (
        <p>{t("web.giftGroup.youDoNotHaveAnyAvailable")}</p>
      )}
    </div>
  );
}

export function LiveWorldMap({
  live,
  season,
  compact = false,
}: {
  live: LiveState;
  season: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const region = worldMapRegion(live.locationId);
  const crop = worldMapCrop(region);
  const cropStyle = {
    aspectRatio: `${crop.width} / ${crop.height}`,
    "--world-map-width": `${(300 / crop.width) * 100}%`,
    "--world-map-left": `${(-crop.x / crop.width) * 100}%`,
    "--world-map-top": `${(-crop.y / crop.height) * 100}%`,
  } as CSSProperties;
  return (
    <div className={`live-world-map focused ${compact ? "compact" : ""}`}>
      <div className="live-world-map-viewport" style={cropStyle}>
        {/* This is extracted from the user's own Stardew installation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/maps/world-${season}.png`}
          alt={t("map.focusedOn", { location: live.location || live.locationId || t("map.currentArea") })}
        />
        <span className={`world-pin location-${region}`}>
          <i />
          <b>{live.location || live.locationId}</b>
        </span>
      </div>
      <small>{t("web.liveWorldMap.liveAreaTile")}{live.tileX}, {live.tileY}{t("web.liveWorldMap.in")}{live.locationId}
      </small>
    </div>
  );
}

export function worldMapCrop(region: string) {
  const crops: Record<string, { x: number; y: number; width: number; height: number }> = {
    farm: { x: 0, y: 45, width: 145, height: 105 },
    busstop: { x: 45, y: 25, width: 135, height: 90 },
    town: { x: 95, y: 25, width: 135, height: 100 },
    mountain: { x: 75, y: 0, width: 155, height: 85 },
    beach: { x: 105, y: 85, width: 165, height: 90 },
    forest: { x: 0, y: 55, width: 155, height: 110 },
    island: { x: 125, y: 360, width: 105, height: 64 },
    desert: { x: 0, y: 0, width: 300, height: 180 },
    unknown: { x: 0, y: 0, width: 300, height: 180 },
  };
  return crops[region] || crops.unknown;
}

export function worldMapRegion(locationId = "") {
  const id = locationId.toLowerCase();
  if (/island|volcano/.test(id)) return "island";
  if (/desert|skullcave/.test(id)) return "desert";
  if (/farm|greenhouse/.test(id)) return "farm";
  if (/busstop|tunnel/.test(id)) return "busstop";
  if (/beach|fishshop|elliotthouse/.test(id)) return "beach";
  if (/forest|woods|wizard|animalshop|sewer/.test(id)) return "forest";
  if (/mountain|mine|railroad|adventureguild|bathhouse|quarry/.test(id))
    return "mountain";
  if (
    /town|seedshop|saloon|hospital|blacksmith|manorhouse|museum|trailer|joja/.test(
      id,
    )
  )
    return "town";
  return "unknown";
}

export function NpcArtwork({
  name,
  kind,
}: {
  name: string;
  kind: "sprite" | "portrait";
}) {
  return (
    <span className={`npc-artwork ${kind}`} aria-hidden="true">
      <b>{name.slice(0, 1)}</b>
      {/* Local spritesheets must retain their original pixels and are not candidates for web image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/${kind === "sprite" ? "characters" : "portraits"}/${encodeURIComponent(name)}.png`}
        alt=""
        onError={(event) => {
          event.currentTarget.hidden = true;
          event.currentTarget.parentElement?.classList.add("missing");
        }}
      />
    </span>
  );
}

export function GrandpaShrineArtwork({ candles }: { candles: number }) {
  // Farm.addGrandpaCandles uses this order and these offsets relative to the
  // vanilla shrine: lower-left, upper-left, upper-right, lower-right.
  const candlePositions = [
    { baseLeft: 74, baseTop: 106, flameLeft: 70, flameTop: 94 },
    { baseLeft: 84, baseTop: 76, flameLeft: 82, flameTop: 64 },
    { baseLeft: 138, baseTop: 76, flameLeft: 136, flameTop: 64 },
    { baseLeft: 148, baseTop: 106, flameLeft: 146, flameTop: 94 },
  ];
  return (
    <span className="grandpa-altar" aria-hidden="true">
      {/* All three images are extracted privately from the local game files. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/sprites/Grandpa%20Shrine%20Scene.png" alt="" />
      {candlePositions.slice(0, candles).map((position, index) => (
        <span className="grandpa-candle" key={index}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="grandpa-candle-base"
            src="/assets/sprites/Grandpa%20Candle%20Base.png"
            alt=""
            style={{ left: position.baseLeft, top: position.baseTop }}
          />
          <span
            className="grandpa-candle-flame"
            style={{
              left: position.flameLeft,
              top: position.flameTop,
              animationDelay: `${index * -50}ms`,
            }}
          />
        </span>
      ))}
    </span>
  );
}
