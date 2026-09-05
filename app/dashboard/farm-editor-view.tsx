"use client";
import { formatNumber } from "./formatting";

import { useFarmEditor } from "./use-farm-editor";

import { useFarmCanvas } from "./use-farm-canvas";

import { buildingSignature, buildingType } from "./farm-model";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { BuildingPreview, InteriorView, spritePaths, tileKey, tools } from "./farm-rendering";
import { buildingDisplayName, localizedInteriorName, localizedTerrainFeature } from "./formatting";
import { type LiveState, type Snapshot } from "./snapshot-types";
import { Toggle } from "./ui";
import { type ActiveView } from "./ui-types";

export function FarmEditorView({ data, live, activeView, base, sprites }: { data: Snapshot; live: LiveState; activeView: ActiveView; base: HTMLImageElement | null; sprites: Record<string, HTMLImageElement> }) {
  const { t, locale } = useI18n();
  const workspaceRef = useRef<HTMLElement>(null);
  const [layersCollapsed, setLayersCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("stardew-tool-layers-collapsed") === "true",
  );
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 230;
    return Math.max(180, Math.min(420, Number(window.localStorage.getItem("stardew-tool-left-panel-width")) || 230));
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 230;
    return Math.max(180, Math.min(420, Number(window.localStorage.getItem("stardew-tool-right-panel-width")) || 230));
  });
  useEffect(() => {
    window.localStorage.setItem(
      "stardew-tool-layers-collapsed",
      String(layersCollapsed),
    );
  }, [layersCollapsed]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-left-panel-width", String(leftPanelWidth));
  }, [leftPanelWidth]);
  useEffect(() => {
    window.localStorage.setItem("stardew-tool-right-panel-width", String(rightPanelWidth));
  }, [rightPanelWidth]);

  const { mapData, selected, mapLocation, showState, setShowState, showProduction, setShowProduction, proposalStates, showSuggestions, setShowSuggestions, showGrid, setShowGrid, showBlocked, setShowBlocked, proposalEditMode, setProposalEditMode, setTool, setMovingProposalId, tool, proposalUndo, setProposalUndo, localSuggestions, persist, setMapLocation, setSelected, setPlacementError, centerOnFarmhouse, setZoom, zoom, mapViewportRef, canvasRef, setHover, pointFromEvent, handleClick, openProposalMenu, proposalMenu, setProposalMenu, placementError, persistProposalResolutions, proposalResolutions, persistProposalLinks, proposalLinks , hover, movingProposalId } = useFarmEditor(data, live, activeView);
  useFarmCanvas({ canvasRef, base, hover, mapData, localSuggestions, movingProposalId, proposalEditMode, proposalStates, showBlocked, showGrid, showProduction, showState, showSuggestions, sprites, tool, activeView, mapLocation });

  const beginPanelResize = (
    side: "left" | "right",
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const resize = (pointer: PointerEvent) => {
      const bounds = workspace.getBoundingClientRect();
      const width = side === "left"
        ? pointer.clientX - bounds.left
        : bounds.right - pointer.clientX;
      const next = Math.max(180, Math.min(420, Math.round(width)));
      if (side === "left") setLeftPanelWidth(next);
      else setRightPanelWidth(next);
    };
    const finish = () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", finish);
    };
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", finish, { once: true });
  };

  const details = (() => {
    if (!mapData || !selected) return [];
    const key = tileKey(selected.x, selected.y);
    const result: string[] = [];
    const feature = mapData.terrain.find((t) => tileKey(t.x, t.y) === key);
    if (feature) result.push(localizedTerrainFeature(feature, t, data.localizedNamesByQualifiedId));
    const object = mapData.objects.find((o) => tileKey(o.x, o.y) === key);
    if (object)
      result.push(
        object.ready
          ? t("map.objectReady", { machine: object.displayName || object.name, output: object.output || t("map.collect") })
          : object.processing
            ? t("map.objectProcessing", { machine: object.displayName || object.name, output: object.output || t("map.product"), days: object.readyInDays || 0 })
            : object.displayName || object.name,
      );
    const building = mapData.buildings.find(
      (b) =>
        selected.x >= b.x &&
        selected.x < b.x + b.width &&
        selected.y >= b.y &&
        selected.y < b.y + b.height,
    );
    if (building) result.push(buildingDisplayName(building.name, t));
    if (
      mapData.map.blocked.some(([x, y]) => x === selected.x && y === selected.y)
    )
      result.push(t("map.nonBuildableTerrain"));
    return result.length ? result : [t("map.emptyTile")];
  })();

  const selectedInterior = data.interiors?.find(
    (item) => item.id === mapLocation,
  );
  const visibleObjects = selectedInterior
    ? selectedInterior.objects
    : mapData!.objects;
  const treeCount = mapData!.terrain.filter((t) => t.kind === "Tree").length;
  const cropCount = mapData!.terrain.filter(
    (t) => t.kind === "HoeDirt" && (t.hasCrop || t.crop),
  ).length;
  const readyMachines = visibleObjects.filter((item) => item.ready);
  const processingMachines = visibleObjects.filter((item) => item.processing);
  const selectedInteriorDetails =
    selectedInterior && selected
      ? [
          ...selectedInterior.objects
            .filter((item) => item.x === selected.x && item.y === selected.y)
            .map((item) =>
              item.ready
                ? t("map.objectReady", { machine: item.displayName || item.name, output: item.output || t("map.collect") })
                : item.processing
                  ? t("map.objectProcessing", { machine: item.displayName || item.name, output: item.output || t("map.product"), days: item.readyInDays || 0 })
                  : item.displayName || item.name,
            ),
          ...selectedInterior.furniture
            .filter((item) => item.x === selected.x && item.y === selected.y)
            .map((item) => item.name),
        ]
      : [];

 return (<section
        ref={workspaceRef}
        className={`workspace ${layersCollapsed ? "layers-collapsed" : ""} ${activeView === "map" ? "" : "view-hidden"}`}
        style={{
          "--left-panel-width": `${leftPanelWidth}px`,
          "--right-panel-width": `${rightPanelWidth}px`,
        } as Record<string, string>}
        aria-hidden={activeView !== "map"}
      >
        <aside className="panel left-panel">
          <button
            className="layers-collapse"
            onClick={() => setLayersCollapsed((value) => !value)}
            aria-expanded={!layersCollapsed}
            title={layersCollapsed ? t("map.openLayers") : t("map.collapseLayers")}
          >
            {layersCollapsed ? "›" : "‹"}
            <span>{t("web.home.layers")}</span>
          </button>
          <div className="layers-content">
            <p className="eyebrow">{t("web.home.layers")}</p>
            <h2>{t("web.home.whatToDisplay")}</h2>
            <Toggle
              label={t("map.dailyState")}
              hint={t("map.objectCount", { count: visibleObjects.length })}
              checked={showState}
              onChange={setShowState}
              color="#6b8f43"
            />
            <Toggle
              label={t("web.home.processing")}
              hint={t("map.productionCount", { ready: readyMachines.length, working: processingMachines.length })}
              checked={showProduction}
              onChange={setShowProduction}
              color="#e5a83e"
            />
            {!selectedInterior && (
              <Toggle
                label={t("map.proposals")}
                hint={t("map.proposalCount", { pending: proposalStates.filter((item) => item.status === "pending").length, building: proposalStates.filter((item) => item.status === "building").length })}
                checked={showSuggestions}
                onChange={setShowSuggestions}
                color="#ffcf5c"
              />
            )}
            <Toggle
              label={t("map.grid")}
              hint={
                selectedInterior
                  ? t("map.tileDimensions", { width: selectedInterior.width, height: selectedInterior.height })
                  : t("map.tileDimensions", { width: 80, height: 65 })
              }
              checked={showGrid}
              onChange={setShowGrid}
              color="#e8dcc4"
            />
            {!selectedInterior && (
              <Toggle
                label={t("map.nonBuildable")}
                hint={t("map.edgesAndWater")}
                checked={showBlocked}
                onChange={setShowBlocked}
                color="#6f496d"
              />
            )}

            {!selectedInterior && (
              <>
                <div className="divider" />
                <button
                  type="button"
                  className={`proposal-edit-toggle ${proposalEditMode ? "active" : ""}`}
                  onClick={() => {
                    setProposalEditMode((value) => !value);
                    setTool("inspect");
                    setMovingProposalId(null);
                  }}
                >
                  {proposalEditMode ? t("map.finishEditing") : t("map.editProposals")}
                </button>
                {proposalEditMode && <>
                <p className="eyebrow">{t("web.home.buildingPalette")}</p>
                <div className="tool-grid proposal-palette">
                  {tools.map((item) => (
                    <button
                      key={item.id}
                      className={tool === item.id ? "tool active" : "tool"}
                      onClick={() => setTool(item.id)}
                    >
                      {item.id !== "inspect" && item.id !== "marker" && spritePaths[item.label] ? (
                        <BuildingPreview name={item.label} />
                      ) : (
                        <span className="tool-preview-placeholder" aria-hidden="true">{item.id === "inspect" ? "⌖" : "+"}</span>
                      )}
                      <span>{t(`map.tool.${item.id}`)}<small>{item.width}×{item.height}</small></span>
                    </button>
                  ))}
                </div>
                <p className="proposal-save-note">{t("web.home.chooseAFootprintAndClickTheMapSelectMove")}</p>
                {proposalUndo && (
                  <button className="clear" onClick={() => {
                    const previous = proposalUndo;
                    setProposalUndo(localSuggestions);
                    persist(previous, false);
                  }}>{t("web.home.undoLastProposalChange")}</button>
                )}
                {localSuggestions.length > 0 && (
                  <button className="clear" onClick={() => persist([])}>{t("web.home.clearMyDrawings")}</button>
                )}
                </>}
              </>
            )}
          </div>
        </aside>

        <div
          className="column-resizer left-column-resizer"
          role="separator"
          aria-label={t("web.home.resizeLayersColumn")}
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("left", event)}
        />

        <section className="map-column">
          <div className="map-toolbar">
            <div className="location-picker">
              <label htmlFor="map-location">{t("storage.view")}</label>
              <select
                id="map-location"
                value={mapLocation}
                onChange={(event) => {
                  setMapLocation(event.target.value);
                  setSelected(null);
                  setPlacementError("");
                }}
              >
                <option value="farm">{t("web.home.farmExterior")}</option>
                {(data.interiors || []).map((interior) => (
                  <option key={interior.id} value={interior.id}>
                    {localizedInteriorName(interior, t)}
                  </option>
                ))}
              </select>
              <span className="crumb">{t("web.home.day")}{data.day}</span>
            </div>
            <div className="map-actions">
              {mapLocation === "farm" && (
                <button
                  className="home-button"
                  onClick={() => centerOnFarmhouse("smooth")}
                  title={t("web.home.centerTheMapOnTheFarmhouse")}
                >{t("web.home.home")}</button>
              )}
              <div className="zoom-control">
                <button onClick={() => setZoom(Math.max(0.65, zoom - 0.15))}>
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(2.1, zoom + 0.15))}>
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="map-viewport" ref={mapViewportRef}>
            {mapLocation === "farm" ? (
              <canvas
                ref={canvasRef}
                width={1280}
                height={1040}
                style={{
                  width: `${1280 * zoom}px`,
                  height: `${1040 * zoom}px`,
                }}
                onMouseMove={(e) => setHover(pointFromEvent(e))}
                onMouseLeave={() => setHover(null)}
                onClick={handleClick}
                onContextMenu={openProposalMenu}
              />
            ) : selectedInterior ? (
              <InteriorView
                interior={selectedInterior}
                zoom={zoom}
                showState={showState}
                showProduction={showProduction}
                showGrid={showGrid}
                sprites={sprites}
                selected={selected}
                onSelect={setSelected}
              />
            ) : null}
            <div className="map-legend">
              <span>
                <i className="current" />
                {live.active && live.farmMap ? t("status.live") : t("map.lastSave")}
              </span>
              {mapLocation === "farm" && (
                <span>
                  <i className="proposal" />{t("web.home.proposal")}</span>
              )}
              <span>
                <i className="ready" />{t("web.home.ready")}</span>
              <span>
                <i className="working" />{t("web.home.processing")}</span>
            </div>
            {proposalMenu && (
              <div
                className="proposal-context-menu"
                role="menu"
                tabIndex={-1}
                style={{ left: proposalMenu.x, top: proposalMenu.y }}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setProposalMenu(null);
                }}
              >
                <strong>{proposalMenu.name}</strong>
                {proposalStates.find((proposal) => proposal.id === proposalMenu.id)?.status === "pending" && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProposalEditMode(true);
                        setMovingProposalId(proposalMenu.id);
                        setTool("inspect");
                        setPlacementError(t("map.proposal.chooseNewPosition"));
                        setProposalMenu(null);
                      }}
                    >{t("web.home.move")}</button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        persistProposalResolutions({ ...proposalResolutions, [proposalMenu.id]: "resolved" });
                        setProposalMenu(null);
                      }}
                    >{t("web.home.markPlanDone")}</button>
                  </>
                )}
                {proposalStates.find((proposal) => proposal.id === proposalMenu.id)?.status === "resolved" && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const next = { ...proposalResolutions };
                      delete next[proposalMenu.id];
                      persistProposalResolutions(next);
                      setProposalMenu(null);
                    }}
                  >{t("web.home.reopenPlan")}</button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    persist(localSuggestions.filter((item) => item.id !== proposalMenu.id));
                    setProposalMenu(null);
                  }}
                >{t("web.home.deleteProposal")}</button>
              </div>
            )}
          </div>
          <div className="tile-strip">
            <div>
              <span>
                {mapLocation === "farm"
                  ? t("storage.tile")
                  : selectedInterior?.label || t("map.interior")}
              </span>
              <strong>{selected ? `${selected.x}, ${selected.y}` : "—"}</strong>
            </div>
            <p className={placementError ? "placement-error" : ""}>
              {mapLocation === "farm"
                ? placementError ||
                  (selected
                    ? details.join(" · ")
                    : t("map.clickPoint"))
                : selected
                  ? selectedInteriorDetails.join(" · ") || t("map.emptyInteriorTile")
                  : t("map.clickInteriorTile")}
            </p>
          </div>
        </section>

        <div
          className="column-resizer right-column-resizer"
          role="separator"
          aria-label={t("web.home.resizeAtAGlanceColumn")}
          aria-orientation="vertical"
          onPointerDown={(event) => beginPanelResize("right", event)}
        />

        <aside className="panel right-panel">
          <p className="eyebrow">{t("web.home.atAGlance")}</p>
          <h2>
            {selectedInterior ? selectedInterior.label : t("map.day", { day: data.day })}
          </h2>
          {selectedInterior ? (
            <>
              <div className="stat">
                <span>{t("web.home.objects")}</span>
                <strong>{selectedInterior.objects.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.furniture")}</span>
                <strong>{selectedInterior.furniture.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.ready")}</span>
                <strong>{readyMachines.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.processing")}</span>
                <strong>{processingMachines.length}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="stat">
                <span>{t("web.home.trees")}</span>
                <strong>{treeCount}</strong>
              </div>
              <div className="stat">
                <span>{t("planning.crops")}</span>
                <strong>{cropCount}</strong>
              </div>
              <div className="stat">
                <span>{t("planning.buildings")}</span>
                <strong>{mapData!.buildings.length}</strong>
              </div>
              <div className="stat">
                <span>{t("web.home.money")}</span>
                <strong>{formatNumber(data.money, locale)}g</strong>
              </div>
              {(data.grandpa.actualCandles || 0) > 0 && (
                <div className="stat">
                  <span>{t("web.home.grandpasShrine")}</span>
                  <strong>{data.grandpa.actualCandles}{t("web.home.candles")}</strong>
                </div>
              )}
            </>
          )}
          <div className="production-summary">
            <span className="eyebrow">{t("web.home.readyToCollect")}</span>
            {readyMachines.length ? (
              readyMachines.map((item, index) => (
                <div
                  className="machine-row ready-machine"
                  key={`${item.x}-${item.y}-${index}`}
                >
                  <strong>{item.output || item.name}</strong>
                  <small>
                    {item.displayName || item.name}{t("web.home.tile")}{item.x}, {item.y})
                  </small>
                </div>
              ))
            ) : (
              <p>{t("web.home.nothingIsReadyInTheCurrentReading")}</p>
            )}
            {processingMachines.length > 0 && (
              <span className="eyebrow production-working-title">{t("web.home.processing")}</span>
            )}
            {processingMachines.slice(0, 8).map((item, index) => (
              <div className="machine-row" key={`${item.x}-${item.y}-${index}`}>
                <strong>{item.output || item.name}</strong>
                <small>
                  {t("map.machineReadyIn", { machine: item.displayName || item.name, days: item.readyInDays || 0 })}
                </small>
              </div>
            ))}
          </div>
          {!selectedInterior && (
            <div className="proposal-list">
              {proposalStates.map((proposal) => {
                const alternatives = mapData!.buildings.filter(
                  (building) =>
                    buildingType(building) === buildingType(proposal) &&
                    (building.x !== proposal.x || building.y !== proposal.y),
                );
                return (
                  <div
                    className={`callout ${proposal.status}`}
                    key={proposal.id}
                  >
                    <span>
                      {proposal.status === "pending"
                        ? t("map.proposal.pending")
                        : proposal.status === "building"
                          ? t("map.proposal.building")
                          : proposal.status === "resolved"
                            ? t("map.proposal.resolved")
                            : t("map.proposal.completed")}
                    </span>
                    <strong>{t(`map.tool.${proposal.kind}`)}</strong>
                    <p>
                      {proposal.status === "building"
                        ? t("map.proposal.robinWorking", { x: proposal.actual?.x || 0, y: proposal.actual?.y || 0, days: proposal.actual?.daysOfConstructionLeft || 0 })
                        : proposal.status === "resolved"
                          ? t("map.proposal.manuallyResolved")
                          : proposal.status === "completed"
                            ? proposal.matchedBy === "manual"
                            ? t("map.proposal.completedElsewhere", { building: buildingDisplayName(proposal.actual?.name || "", t), x: proposal.actual?.x || 0, y: proposal.actual?.y || 0 })
                            : t("map.proposal.detectedAtTiles")
                          : t("map.proposal.position", { x: proposal.x, y: proposal.y, width: proposal.width, height: proposal.height })}
                    </p>
                    {proposalEditMode && proposal.status === "pending" && (
                      <div className="proposal-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setMovingProposalId(proposal.id);
                            setTool("inspect");
                            setPlacementError(t("map.proposal.chooseNewPosition"));
                          }}
                        >{t("web.home.move")}</button>
                        <button
                          type="button"
                          onClick={() =>
                            persist(localSuggestions.filter((item) => item.id !== proposal.id))
                          }
                        >{t("web.home.delete")}</button>
                        <button
                          type="button"
                          onClick={() =>
                            persistProposalResolutions({
                              ...proposalResolutions,
                              [proposal.id]: "resolved",
                            })
                          }
                        >{t("web.home.markPlanDone")}</button>
                      </div>
                    )}
                    {proposal.status === "resolved" && proposalEditMode && (
                      <button
                        className="proposal-reopen"
                        onClick={() => {
                          const next = { ...proposalResolutions };
                          delete next[proposal.id];
                          persistProposalResolutions(next);
                        }}
                      >{t("web.home.reopenPlan")}</button>
                    )}
                    {proposal.status === "pending" &&
                      alternatives.length > 0 && (
                        <div className="proposal-match">
                          <small>{t("web.home.alreadyBuiltElsewhere")}</small>
                          {alternatives.map((building) => (
                            <button
                              key={buildingSignature(building)}
                              onClick={() =>
                                persistProposalLinks({
                                  ...proposalLinks,
                                  [proposal.id]: buildingSignature(building),
                                })
                              }
                            >{t("web.home.use")}{buildingDisplayName(building.name, t)}{t("web.home.at")}{building.x}, {building.y}
                              )
                            </button>
                          ))}
                        </div>
                      )}
                    {proposal.matchedBy === "manual" && (
                      <button
                        className="proposal-reopen"
                        onClick={() => {
                          const next = { ...proposalLinks };
                          delete next[proposal.id];
                          persistProposalLinks(next);
                        }}
                      >{t("web.home.reopenProposal")}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="fine-print">{t("web.home.thisViewOnlyReadsACopyOfTheSave")}{" "}
            {selectedInterior
              ? t("map.interiorReadOnlyNote")
              : t("map.drawingsReadOnlyNote")}
          </p>
        </aside>
      </section>);
}
