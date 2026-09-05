"use client";

import { useCallback, useEffect, type RefObject } from "react";
import type { Snapshot, Tile, Suggestion } from "./snapshot-types";
import type { ProposalState, ActiveView } from "./ui-types";
import { TILE, sprite, cropSpriteSource, drawBuildingSprite, tools } from "./farm-rendering";

export type FarmCanvasOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  base: HTMLImageElement | null;
  hover: Tile | null;
  mapData: Snapshot | null;
  localSuggestions: Suggestion[];
  movingProposalId: string | null;
  proposalEditMode: boolean;
  proposalStates: ProposalState[];
  showBlocked: boolean;
  showGrid: boolean;
  showProduction: boolean;
  showState: boolean;
  showSuggestions: boolean;
  sprites: Record<string, HTMLImageElement>;
  tool: string;
  activeView: ActiveView;
  mapLocation: string;
};

export function useFarmCanvas({ canvasRef, base, hover, mapData, localSuggestions, movingProposalId, proposalEditMode, proposalStates, showBlocked, showGrid, showProduction, showState, showSuggestions, sprites, tool, activeView, mapLocation }: FarmCanvasOptions) {
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData || !base) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);

    if (mapData.farmType === 0 && (mapData.grandpa.actualCandles || 0) > 0) {
      const candleTiles = [
        [7.65, 8.15],
        [8.15, 7.55],
        [8.85, 7.55],
        [9.35, 8.15],
      ];
      candleTiles
        .slice(0, mapData.grandpa.actualCandles)
        .forEach(([x, y]) => {
          ctx.fillStyle = "#8b4a20";
          ctx.fillRect(x * TILE, y * TILE, 2, 5);
          ctx.fillStyle = "#ffd65a";
          ctx.fillRect(x * TILE - 1, y * TILE - 4, 4, 4);
          ctx.fillStyle = "#fff4a0";
          ctx.fillRect(x * TILE, y * TILE - 3, 2, 2);
        });
    }

    if (showBlocked) {
      ctx.fillStyle = "rgba(72, 38, 76, .26)";
      for (const [x, y] of mapData.map.blocked)
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }

    if (showState) {
      const tall: { bottom: number; paint: () => void }[] = [];
      for (const feature of mapData.terrain) {
        const px = feature.x * TILE,
          py = feature.y * TILE;
        if (feature.kind === "HoeDirt") {
          const soilOffset = feature.watered ? 128 : 0;
          sprite(
            ctx,
            sprites.hoeDirt,
            [soilOffset + 16, 0, 32, 32],
            [px, py, 16, 16],
          );
          if (feature.crop && feature.cropRow !== undefined)
            tall.push({
              bottom: py + TILE,
              paint: () => {
                const phase = feature.dead
                  ? 6
                  : Math.min(feature.phase || 0, 5);
                sprite(
                  ctx,
                  sprites.crops,
                  cropSpriteSource(feature.cropRow!, phase),
                  [px, py - 16],
                  Boolean(feature.flip),
                );
              },
            });
        } else if (feature.kind === "Grass") {
          const variant = Math.abs(feature.x * 17 + feature.y * 31) % 3;
          tall.push({
            bottom: py + TILE,
            paint: () =>
              sprite(
                ctx,
                sprites.grass,
                [variant * 15, 0, 15, 20],
                [px, py - 4],
              ),
          });
        } else if (feature.kind === "Tree") {
          const tree = sprites[feature.treeType || "Oak"] || sprites.Oak;
          tall.push({
            bottom: py + TILE,
            paint: () => {
              const stage = feature.stage || 0;
              if (feature.stump && stage >= 5)
                sprite(ctx, tree, [16, 96, 32, 32], [px - 8, py - 16]);
              else if (stage >= 5)
                sprite(ctx, tree, [0, 0, 48, 96], [px - 16, py - 80]);
              else if (stage === 4)
                sprite(ctx, tree, [0, 96, 16, 32], [px, py - 16]);
              else if (stage === 3)
                sprite(ctx, tree, [32, 128, 16, 16], [px, py]);
              else {
                const sourceX = stage === 0 ? 48 : stage === 1 ? 0 : 16;
                sprite(ctx, tree, [sourceX, 128, 16, 16], [px, py]);
              }
              if (feature.fertilized && stage < 5) {
                ctx.strokeStyle = "#ffe878";
                ctx.strokeRect(px + 1.5, py + 1.5, 13, 13);
              }
            },
          });
        } else if (feature.kind === "FruitTree") {
          tall.push({
            bottom: py + TILE,
            paint: () => {
              const row = Math.max(
                0,
                Math.min(8, Number(feature.treeId || 628) - 628),
              );
              const slot = Math.min(feature.stage || 0, 4);
              sprite(
                ctx,
                sprites.fruitTrees,
                [slot * 48, row * 80, 48, 80],
                [px - 16, py - 64],
              );
            },
          });
        }
      }

      for (const object of mapData.objects) {
        const index = Number(object.id);
        if (!Number.isFinite(index)) continue;
        const px = object.x * TILE,
          py = object.y * TILE;
        tall.push({
          bottom: py + TILE,
          paint: () => {
            if (object.big)
              sprite(
                ctx,
                sprites.craftables,
                [(index % 8) * 16, Math.floor(index / 8) * 32, 16, 32],
                [px, py - 16],
              );
            else
              sprite(
                ctx,
                sprites.objects,
                [(index % 24) * 16, Math.floor(index / 24) * 16, 16, 16],
                [px, py],
              );
          },
        });
      }

      for (const clump of mapData.clumps) {
        tall.push({
          bottom: (clump.y + clump.height) * TILE,
          paint: () => {
            const index = Number(clump.id);
            for (let y = 0; y < clump.height; y++)
              for (let x = 0; x < clump.width; x++) {
                const part = index + y * 24 + x;
                sprite(
                  ctx,
                  sprites.objects,
                  [(part % 24) * 16, Math.floor(part / 24) * 16, 16, 16],
                  [(clump.x + x) * TILE, (clump.y + y) * TILE],
                );
              }
          },
        });
      }

      for (const building of mapData.buildings) {
        tall.push({
          bottom: (building.y + building.height) * TILE,
          paint: () => {
            const px = building.x * TILE,
              py = building.y * TILE;
            if (!drawBuildingSprite(ctx, sprites, building)) {
              ctx.fillStyle = "rgba(116,82,154,.35)";
              ctx.fillRect(
                px,
                py,
                building.width * TILE,
                building.height * TILE,
              );
            }
            if ((building.daysOfConstructionLeft || 0) > 0) {
              ctx.fillStyle = "rgba(240, 167, 55, .2)";
              ctx.strokeStyle = "#ffd166";
              ctx.lineWidth = 2;
              ctx.setLineDash([5, 3]);
              ctx.fillRect(
                px,
                py,
                building.width * TILE,
                building.height * TILE,
              );
              ctx.strokeRect(
                px + 1,
                py + 1,
                building.width * TILE - 2,
                building.height * TILE - 2,
              );
              ctx.setLineDash([]);
            }
          },
        });
      }
      tall
        .sort((a, b) => a.bottom - b.bottom)
        .forEach((entity) => entity.paint());

      if (showProduction) {
        for (const object of mapData.objects.filter(
          (item) => item.ready || item.processing,
        )) {
          const cx = object.x * TILE + 12,
            cy = object.y * TILE + 3;
          ctx.beginPath();
          ctx.fillStyle = object.ready ? "#69c36a" : "#e5a83e";
          ctx.strokeStyle = "#fff6d8";
          ctx.lineWidth = 1.5;
          ctx.arc(cx, cy, object.ready ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          {
            ctx.fillStyle = "#172219";
            ctx.font = "bold 7px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(object.ready ? "✓" : "◷", cx, cy + 0.5);
          }
        }
      }
    }

    if (showSuggestions) {
      for (const suggestion of proposalStates.filter(
        (item) => item.status === "pending",
      )) {
        ctx.globalAlpha = 0.82;
        const hasSprite = drawBuildingSprite(ctx, sprites, suggestion);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `${suggestion.color}80`;
        ctx.strokeStyle = "rgba(30, 25, 18, .9)";
        ctx.lineWidth = 5;
        ctx.setLineDash([5, 3]);
        ctx.fillRect(
          suggestion.x * TILE,
          suggestion.y * TILE,
          suggestion.width * TILE,
          suggestion.height * TILE,
        );
        ctx.strokeRect(
          suggestion.x * TILE + 1,
          suggestion.y * TILE + 1,
          suggestion.width * TILE - 2,
          suggestion.height * TILE - 2,
        );
        ctx.strokeStyle = suggestion.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(
          suggestion.x * TILE + 1,
          suggestion.y * TILE + 1,
          suggestion.width * TILE - 2,
          suggestion.height * TILE - 2,
        );
        ctx.setLineDash([]);
        if (!hasSprite || proposalEditMode) {
          const label = suggestion.name.replace(
            /^(Proposed|Future|Optional) /,
            "",
          );
          ctx.font = "bold 9px Arial";
          ctx.fillStyle = "rgba(28, 25, 23, .82)";
          ctx.fillRect(
            suggestion.x * TILE + 3,
            suggestion.y * TILE + 3,
            Math.min(
              suggestion.width * TILE - 6,
              ctx.measureText(label).width + 10,
            ),
            16,
          );
          ctx.fillStyle = "#fff8e8";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(
            label,
            suggestion.x * TILE + 8,
            suggestion.y * TILE + 11,
            suggestion.width * TILE - 12,
          );
        }
      }
    }

    if (showGrid) {
      ctx.strokeStyle = "rgba(50, 38, 29, .24)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= mapData.map.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE + 0.5, 0);
        ctx.lineTo(x * TILE + 0.5, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= mapData.map.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE + 0.5);
        ctx.lineTo(canvas.width, y * TILE + 0.5);
        ctx.stroke();
      }
    }

    if (hover) {
      const moving = movingProposalId
        ? localSuggestions.find((item) => item.id === movingProposalId)
        : null;
      const selectedTool = tools.find((item) => item.id === tool) || tools[0];
      const active = moving || selectedTool;
      if (proposalEditMode && (moving || tool !== "inspect")) {
        ctx.globalAlpha = 0.78;
        drawBuildingSprite(ctx, sprites, {
          ...active,
          name: moving?.name || selectedTool.label,
          x: hover.x,
          y: hover.y,
        });
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle =
        tool === "inspect" && !moving
          ? "rgba(255,255,255,.22)"
          : "rgba(255, 224, 117, .35)";
      ctx.strokeStyle = "#fff1a8";
      ctx.lineWidth = 2;
      ctx.fillRect(
        hover.x * TILE,
        hover.y * TILE,
        active.width * TILE,
        active.height * TILE,
      );
      ctx.strokeRect(
        hover.x * TILE + 1,
        hover.y * TILE + 1,
        active.width * TILE - 2,
        active.height * TILE - 2,
      );
    }
  }, [
    canvasRef,
    base,
    hover,
    mapData,
    localSuggestions,
    movingProposalId,
    proposalEditMode,
    proposalStates,
    showBlocked,
    showGrid,
    showProduction,
    showState,
    showSuggestions,
    sprites,
    tool,
  ]);

  useEffect(() => {
    if (activeView !== "map") return;
    draw();
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(draw);
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [activeView, draw, mapLocation]);
  return draw;
}
