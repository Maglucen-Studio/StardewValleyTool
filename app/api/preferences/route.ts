import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

const directory = resolve(process.env.STARDEW_TOOL_RUNTIME_ROOT || process.cwd(), ".local");
const profileId = (process.env.STARDEW_TOOL_PROFILE_ID || "default")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .slice(0, 96) || "default";
const file = resolve(directory, "farms", profileId, "preferences.json");

async function readPreferences() {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return {};
  }
}

function mergeTodayTaskDay(current: unknown, incoming: unknown) {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return current;
  const candidate = incoming as { dateKey?: unknown; tasks?: unknown };
  if (typeof candidate.dateKey !== "string" || candidate.dateKey.length > 40) return current;
  if (!candidate.tasks || typeof candidate.tasks !== "object" || Array.isArray(candidate.tasks)) return current;
  const currentStore = current && typeof current === "object" && !Array.isArray(current)
    ? current as { days?: Record<string, unknown> }
    : {};
  const days = {
    ...(currentStore.days || {}),
    [candidate.dateKey]: {
      updatedAt: new Date().toISOString(),
      tasks: Object.fromEntries(Object.entries(candidate.tasks).slice(0, 100)),
    },
  };
  return { version: 1, days: Object.fromEntries(Object.entries(days).slice(-14)) };
}

export async function GET() {
  return Response.json(await readPreferences(), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const incoming = await request.json();
  const current = await readPreferences();
  const next = {
    ...current,
    ...(Array.isArray(incoming.suggestions) ? { suggestions: incoming.suggestions.slice(0, 200) } : {}),
    ...(incoming.proposalLinks && typeof incoming.proposalLinks === "object" && !Array.isArray(incoming.proposalLinks) ? { proposalLinks: incoming.proposalLinks } : {}),
    ...(incoming.proposalResolutions && typeof incoming.proposalResolutions === "object" && !Array.isArray(incoming.proposalResolutions) ? { proposalResolutions: incoming.proposalResolutions } : {}),
    ...(incoming.map && typeof incoming.map === "object" ? { map: incoming.map } : {}),
    ...(Array.isArray(incoming.goals) ? { goals: incoming.goals.slice(0, 100) } : {}),
    ...(incoming.todayTaskDay ? {
      todayTasks: mergeTodayTaskDay(current.todayTasks, incoming.todayTaskDay),
    } : {}),
  };
  await mkdir(directory, { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2), "utf8");
  return Response.json({ ok: true });
}
