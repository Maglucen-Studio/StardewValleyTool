import type { Building, Suggestion } from "./snapshot-types";
import type { ProposalState } from "./ui-types";

export function buildingType(item: Pick<Building, "name"> & { kind?: string }) {
  const value = `${item.kind || ""} ${item.name}`.toLowerCase();
  if (value.includes("deluxe coop")) return "deluxecoop";
  if (value.includes("big coop")) return "bigcoop";
  if (value.includes("deluxe barn")) return "deluxebarn";
  if (value.includes("big barn")) return "bigbarn";
  if (value.includes("big shed")) return "bigshed";
  if (value.includes("junimo hut")) return "junimohut";
  if (value.includes("earth obelisk")) return "earthobelisk";
  if (value.includes("water obelisk")) return "waterobelisk";
  if (value.includes("desert obelisk")) return "desertobelisk";
  if (value.includes("island obelisk")) return "islandobelisk";
  if (value.includes("gold clock")) return "goldclock";
  if (value.includes("farmhouse upgrade")) return "farmhouse";
  if (value.includes("cabin")) return "cabin";
  if (value.includes("silo")) return "silo";
  if (value.includes("coop")) return "coop";
  if (value.includes("barn")) return "barn";
  if (value.includes("stable")) return "stable";
  if (value.includes("fish pond") || value.includes("fishpond"))
    return "fishpond";
  if (value.includes("slime hutch") || value.includes("slimehutch"))
    return "slimehutch";
  if (value.includes("shed")) return "shed";
  if (value.includes("well")) return "well";
  if (value.includes("mill")) return "mill";
  return value.trim();
}

export function buildingSignature(building: Building) {
  return `${buildingType(building)}:${building.x}:${building.y}:${building.width}:${building.height}`;
}

export function reconcileProposals(
  proposals: Suggestion[],
  buildings: Building[],
  proposalLinks: Record<string, string> = {},
  proposalResolutions: Record<string, "resolved"> = {},
): ProposalState[] {
  const seen = new Set<string>();
  return proposals
    .filter((proposal) => {
      const signature = `${buildingType(proposal)}:${proposal.x}:${proposal.y}:${proposal.width}:${proposal.height}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .map((proposal) => {
      const exact = buildings.find(
        (building) =>
          buildingType(building) === buildingType(proposal) &&
          building.x === proposal.x &&
          building.y === proposal.y &&
          building.width === proposal.width &&
          building.height === proposal.height,
      );
      const manual = proposalLinks[proposal.id]
        ? buildings.find(
            (building) =>
              buildingSignature(building) === proposalLinks[proposal.id] &&
              buildingType(building) === buildingType(proposal),
          )
        : undefined;
      const actual = exact || manual;
      if (!actual)
        return {
          ...proposal,
          status: proposalResolutions[proposal.id] || "pending",
        };
      return {
        ...proposal,
        actual,
        matchedBy: exact ? "position" : "manual",
        status:
          actual.daysOfConstructionLeft || actual.daysUntilUpgrade
            ? "building"
            : "completed",
      };
    });
}
