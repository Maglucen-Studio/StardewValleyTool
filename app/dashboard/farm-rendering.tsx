"use client";

import { useI18n } from "../i18n";
import { useRef } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { furnitureDestination } from "../furniture-layout.mjs";
import { type Building, type Interior, type Tile } from "./snapshot-types";
import { buildingType } from "./farm-model";

export const TILE = 16;

export const spritePaths: Record<string, string> = {
  objects: "/assets/sprites/springobjects.png",
  objects2: "/assets/sprites/Objects_2.png",
  craftables: "/assets/sprites/Craftables.png",
  furniture: "/assets/sprites/furniture.png",
  weapons: "/assets/sprites/weapons.png",
  tools: "/assets/sprites/tools.png",
  hats: "/assets/sprites/hats.png",
  shirts: "/assets/sprites/shirts.png",
  crops: "/assets/sprites/crops.png",
  grass: "/assets/sprites/grass.png",
  hoeDirt: "/assets/sprites/hoeDirt.png",
  Oak: "/assets/sprites/tree1_spring.png",
  Maple: "/assets/sprites/tree2_spring.png",
  Pine: "/assets/sprites/tree3_spring.png",
  Mahogany: "/assets/sprites/tree8_spring.png",
  fruitTrees: "/assets/sprites/fruitTrees.png",
  Farmhouse: "/assets/sprites/houses.png",
  Greenhouse: "/assets/sprites/Greenhouse.png",
  "Shipping Bin": "/assets/sprites/Shipping Bin.png",
  "Pet Bowl": "/assets/sprites/Pet Bowl.png",
  Silo: "/assets/sprites/Silo.png",
  Coop: "/assets/sprites/Coop.png",
  "Big Coop": "/assets/sprites/Big Coop.png",
  "Deluxe Coop": "/assets/sprites/Deluxe Coop.png",
  Barn: "/assets/sprites/Barn.png",
  "Big Barn": "/assets/sprites/Big Barn.png",
  "Deluxe Barn": "/assets/sprites/Deluxe Barn.png",
  Stable: "/assets/sprites/Stable.png",
  Shed: "/assets/sprites/Shed.png",
  "Big Shed": "/assets/sprites/Big Shed.png",
  "Fish Pond": "/assets/sprites/Fish Pond.png",
  "Slime Hutch": "/assets/sprites/Slime Hutch.png",
  Well: "/assets/sprites/Well.png",
  Mill: "/assets/sprites/Mill.png",
  "Junimo Hut": "/assets/sprites/Junimo Hut.png",
  "Earth Obelisk": "/assets/sprites/Earth Obelisk.png",
  "Water Obelisk": "/assets/sprites/Water Obelisk.png",
  "Desert Obelisk": "/assets/sprites/Desert Obelisk.png",
  "Island Obelisk": "/assets/sprites/Island Obelisk.png",
  "Gold Clock": "/assets/sprites/Gold Clock.png",
  "Log Cabin": "/assets/sprites/Log Cabin.png",
};

export const tools = [
  { id: "inspect", label: "Inspect", width: 1, height: 1 },
  { id: "marker", label: "Marker", width: 1, height: 1 },
  { id: "well", label: "Well", width: 3, height: 3 },
  { id: "silo", label: "Silo", width: 3, height: 3 },
  { id: "coop", label: "Coop", width: 6, height: 3 },
  { id: "barn", label: "Barn", width: 7, height: 4 },
  { id: "stable", label: "Stable", width: 4, height: 2 },
  { id: "shed", label: "Shed", width: 7, height: 3 },
  { id: "fishpond", label: "Fish Pond", width: 5, height: 5 },
  { id: "slimehutch", label: "Slime Hutch", width: 7, height: 4 },
  { id: "mill", label: "Mill", width: 4, height: 2 },
];

export function tileKey(x: number, y: number) {
  return `${x},${y}`;
}



export const buildingSpriteDefinitions: Record<
  string,
  { image: string; source: [number, number, number, number]; offsetX?: number }
> = {
  farmhouse: { image: "Farmhouse", source: [0, 0, 160, 144], offsetX: -16 },
  greenhouse: { image: "Greenhouse", source: [0, 0, 112, 160] },
  "shipping bin": { image: "Shipping Bin", source: [0, 0, 32, 32] },
  "pet bowl": { image: "Pet Bowl", source: [0, 0, 32, 32] },
  silo: { image: "Silo", source: [0, 0, 48, 128] },
  coop: { image: "Coop", source: [0, 0, 96, 128] },
  bigcoop: { image: "Big Coop", source: [0, 0, 96, 128] },
  deluxecoop: { image: "Deluxe Coop", source: [0, 0, 96, 128] },
  barn: { image: "Barn", source: [0, 0, 112, 128] },
  bigbarn: { image: "Big Barn", source: [0, 0, 112, 128] },
  deluxebarn: { image: "Deluxe Barn", source: [0, 0, 112, 128] },
  stable: { image: "Stable", source: [0, 0, 64, 96] },
  shed: { image: "Shed", source: [0, 0, 112, 128] },
  bigshed: { image: "Big Shed", source: [0, 0, 112, 128] },
  fishpond: { image: "Fish Pond", source: [0, 0, 80, 80] },
  slimehutch: { image: "Slime Hutch", source: [0, 0, 112, 112] },
  well: { image: "Well", source: [0, 0, 48, 80] },
  mill: { image: "Mill", source: [0, 0, 64, 112] },
  junimohut: { image: "Junimo Hut", source: [0, 0, 64, 64] },
  earthobelisk: { image: "Earth Obelisk", source: [0, 0, 48, 128] },
  waterobelisk: { image: "Water Obelisk", source: [0, 0, 48, 128] },
  desertobelisk: { image: "Desert Obelisk", source: [0, 0, 48, 128] },
  islandobelisk: { image: "Island Obelisk", source: [0, 0, 48, 128] },
  goldclock: { image: "Gold Clock", source: [0, 0, 48, 80] },
  cabin: { image: "Log Cabin", source: [0, 0, 80, 112] },
};





export function sprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  source: [number, number, number, number],
  destination: [number, number, number?, number?],
  flip = false,
) {
  if (!image) return;
  const [sx, sy, sw, sh] = source;
  const [dx, dy, dw = sw, dh = sh] = destination;
  ctx.save();
  if (flip) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
  } else {
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();
}

export function cropSpriteSource(
  row: number,
  phase: number,
): [number, number, number, number] {
  const safeRow = Math.max(0, row);
  const safePhase = Math.max(0, Math.min(7, phase));
  return [
    (safeRow % 2) * 128 + safePhase * TILE,
    Math.floor(safeRow / 2) * 32,
    TILE,
    32,
  ];
}

export function drawBuildingSprite(
  ctx: CanvasRenderingContext2D,
  sprites: Record<string, HTMLImageElement>,
  building: Pick<Building, "name" | "x" | "y" | "width" | "height"> & {
    kind?: string;
  },
) {
  const definition = buildingSpriteDefinitions[buildingType(building)];
  const image = definition && sprites[definition.image];
  if (!definition || !image) return false;
  const [, , width, height] = definition.source;
  const rise = Math.max(0, height - building.height * TILE);
  sprite(ctx, image, definition.source, [
    building.x * TILE + (definition.offsetX || 0),
    building.y * TILE - rise,
    width,
    height,
  ]);
  return true;
}

export function BuildingPreview({
  name,
  catalog = false,
}: {
  name: string;
  catalog?: boolean;
}) {
  const { t } = useI18n();
  const definition = buildingSpriteDefinitions[buildingType({ name })];
  const frameWidth = catalog ? 96 : 42;
  const frameHeight = catalog ? 76 : 38;
  if (!definition) {
    return <span className={catalog ? "building-catalog-artwork missing" : "tool-preview-placeholder"} />;
  }
  const [sourceX, sourceY, sourceWidth, sourceHeight] = definition.source;
  const scale = Math.min((frameWidth - 4) / sourceWidth, (frameHeight - 4) / sourceHeight);
  const outputWidth = sourceWidth * scale;
  const outputHeight = sourceHeight * scale;
  return (
    <span
      className={catalog ? "building-catalog-artwork" : "tool-preview"}
      role="img"
      aria-label={t("artwork.buildingSprite", { name })}
    >
      {/* Building textures are extracted locally from the installed game. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={spritePaths[definition.image]}
        alt=""
        style={{
          left: (frameWidth - outputWidth) / 2 - sourceX * scale,
          top: frameHeight - outputHeight - sourceY * scale,
          transform: `scale(${scale})`,
        }}
      />
    </span>
  );
}

export function InteriorView({
  interior,
  zoom,
  showState,
  showProduction,
  showGrid,
  sprites,
  selected,
  onSelect,
}: {
  interior: Interior;
  zoom: number;
  showState: boolean;
  showProduction: boolean;
  showGrid: boolean;
  sprites: Record<string, HTMLImageElement>;
  selected: Tile | null;
  onSelect: (tile: Tile) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [background, setBackground] = useState<{
    path: string;
    image: HTMLImageElement;
  } | null>(null);
  const [foreground, setForeground] = useState<{
    path: string;
    image: HTMLImageElement;
  } | null>(null);
  const size = 32;

  useEffect(() => {
    if (!interior.background) return;
    const path = interior.background;
    const image = new Image();
    image.onload = () => setBackground({ path, image });
    image.src = path;
  }, [interior.background]);

  useEffect(() => {
    if (!interior.foreground) return;
    const path = interior.foreground;
    const image = new Image();
    image.onload = () => setForeground({ path, image });
    image.src = path;
  }, [interior.foreground]);

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    const currentBackground = background;
    if (currentBackground?.path === interior.background) {
      ctx.drawImage(currentBackground!.image, 0, 0, element.width, element.height);
    } else {
      ctx.fillStyle = "#6f5437";
      ctx.fillRect(0, 0, element.width, element.height);
      for (let y = 0; y < interior.height; y += 1)
        for (let x = 0; x < interior.width; x += 1) {
          const edge =
            x === 0 ||
            y === 0 ||
            x === interior.width - 1 ||
            y === interior.height - 1;
          ctx.fillStyle = edge
            ? (x + y) % 2
              ? "#76573a"
              : "#684b32"
            : (x + y) % 2
              ? "#c99f67"
              : "#d2aa70";
          ctx.fillRect(x * size, y * size, size, size);
          if (!edge) {
            ctx.fillStyle = "rgba(255,239,190,.08)";
            ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
          }
        }
    }

    const entities = [
      ...interior.furniture.map((item) => ({
        ...item,
        entity: "furniture" as const,
      })),
      ...(showState
        ? interior.objects.map((item) => ({
            ...item,
            entity: "object" as const,
          }))
        : []),
    ].sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      const px = entity.x * size,
        py = entity.y * size;
      if (entity.entity === "object") {
        const index = Number(entity.id);
        if (Number.isFinite(index)) {
          if (entity.big)
            sprite(
              ctx,
              sprites.craftables,
              [(index % 8) * 16, Math.floor(index / 8) * 32, 16, 32],
              [px, py - size, size, size * 2],
            );
          else
            sprite(
              ctx,
              sprites.objects,
              [(index % 24) * 16, Math.floor(index / 24) * 16, 16, 16],
              [px, py, size, size],
            );
        }
        if (showProduction && (entity.ready || entity.processing)) {
          ctx.beginPath();
          ctx.fillStyle = entity.ready ? "#69c36a" : "#e5a83e";
          ctx.strokeStyle = "#fff6d8";
          ctx.lineWidth = 2;
          ctx.arc(px + size - 5, py + 5, entity.ready ? 7 : 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (entity.ready) {
            ctx.fillStyle = "white";
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("✓", px + size - 5, py + 6);
          }
        }
      } else if (
        entity.sourceWidth &&
        entity.sourceHeight &&
        sprites.furniture
      ) {
        const destination = furnitureDestination(entity, size);
        sprite(
          ctx,
          sprites.furniture,
          [
            entity.sourceX || 0,
            entity.sourceY || 0,
            entity.sourceWidth,
            entity.sourceHeight,
          ],
          destination,
        );
      } else {
        ctx.fillStyle = "#9a7048";
        ctx.strokeStyle = "#5b402a";
        ctx.lineWidth = 2;
        ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
        ctx.strokeRect(px + 3, py + 3, size - 6, size - 6);
        ctx.fillStyle = "#f5dfb5";
        ctx.font = "bold 9px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          entity.name.slice(0, 2).toUpperCase(),
          px + size / 2,
          py + size / 2,
        );
      }
    }

    const currentForeground = foreground;
    if (currentForeground && currentForeground.path === interior.foreground) {
      ctx.drawImage(currentForeground.image, 0, 0, element.width, element.height);
    }

    if (showGrid) {
      ctx.strokeStyle = "rgba(58,39,25,.28)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= interior.width; x += 1) {
        ctx.beginPath();
        ctx.moveTo(x * size + 0.5, 0);
        ctx.lineTo(x * size + 0.5, element.height);
        ctx.stroke();
      }
      for (let y = 0; y <= interior.height; y += 1) {
        ctx.beginPath();
        ctx.moveTo(0, y * size + 0.5);
        ctx.lineTo(element.width, y * size + 0.5);
        ctx.stroke();
      }
    }
    if (selected) {
      ctx.strokeStyle = "#ffe17a";
      ctx.lineWidth = 3;
      ctx.strokeRect(
        selected.x * size + 2,
        selected.y * size + 2,
        size - 4,
        size - 4,
      );
    }
  }, [
    background,
    foreground,
    interior,
    selected,
    showGrid,
    showProduction,
    showState,
    sprites,
  ]);

  return (
    <div
      className="interior-stage"
      style={{
        width: interior.width * size * zoom,
        height: interior.height * size * zoom,
      }}
    >
      <canvas
        ref={canvas}
        width={interior.width * size}
        height={interior.height * size}
        style={{
          width: interior.width * size * zoom,
          height: interior.height * size * zoom,
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onSelect({
            x: Math.floor(
              ((event.clientX - rect.left) / rect.width) * interior.width,
            ),
            y: Math.floor(
              ((event.clientY - rect.top) / rect.height) * interior.height,
            ),
          });
        }}
      />
    </div>
  );
}
