import type { AppLanguageMode } from "../i18n";
import type { ModCompatibilitySummary } from "../compatibility";
import { type Suggestion, type Building, type FishingFish, type StorageInventoryItem, type Progress, type LocalizedValue } from "./snapshot-types";

export type ProposalState = Suggestion & {
  status: "pending" | "building" | "completed" | "resolved";
  actual?: Building;
  matchedBy?: "position" | "manual";
};

export type DisplayFishingFish = FishingFish & { displayName: string };

export type PersonalGoal = {
  id: string;
  title: string;
  targetId?: string;
  deadline?: string;
  done: boolean;
  createdAt: string;
};

export type TodayTaskStatus = "active" | "completed" | "dismissed" | "postponed";

export type TodayTaskRecord = {
  id: string;
  status: TodayTaskStatus;
  title: string;
  detail: string;
  level: string;
  completionMode?: "manual" | "automatic";
  evidence?: string;
  baseline?: number;
  updatedAt: string;
  carriedFrom?: string;
};

export type StrategicGoalTarget = {
  id: string;
  category: string;
  title: string;
  progress: string;
  bottleneck: string;
  forecast: string;
  ready: boolean;
  requirements: {
    id?: string;
    name: string;
    available: number;
    required: number;
    suffix?: string;
    artwork?: StorageInventoryItem;
  }[];
  requirementsLabel?: string;
};

export type HistoryEntry = {
  dateKey: string;
  dayIndex: number;
  season: string;
  seasonLabel: string;
  day: number;
  year: number;
  money: number;
  totalMoneyEarned: number;
  income: number;
  spending: number;
  buildings: number;
  trees: number;
  crops: number;
  progress: Progress;
  friendships?: { id?: string; name: string; points: number }[];
  petFriendship?: number;
  annotations?: LocalizedValue[];
};

export type FarmHistory = { profileId: string; farmName: string; entries: HistoryEntry[] };

export type SessionSummary = {
  profileId: string;
  capturedAt: number;
  dateKey: string;
  money: number;
  totalMoneyEarned: number;
  readyCrops: number;
  readyMachines: number;
  buildings: string[];
  friendships: Record<string, number>;
  completedBundles: number;
  completedAchievements: string[];
  activeQuests: string[];
};

export type LiveAlertKind =
  | "machines"
  | "crops"
  | "birthdays"
  | "deadlines"
  | "energy"
  | "tool"
  | "bundles";

export type LiveAlertSettings = Record<LiveAlertKind, boolean>;

export type LiveAlert = {
  kind: LiveAlertKind;
  title: string;
  detail: string;
  tone: "urgent" | "ready" | "info";
};

export type DisplayNamedGameValue = { id?: string; name: string; displayName?: string };

export type Translate = (key: string, variables?: Record<string, string | number>) => string;

export type GameNameIndex = {
  normalized: Map<string, string>;
  templates: { prefix: string; suffix: string; localized: string }[];
};

export type ActiveView =
  | "map"
  | "farm"
  | "growth"
  | "achievements"
  | "agenda"
  | "fishing"
  | "planning";

export type UpdateState = {
  status:
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "current"
    | "unavailable"
    | "error";
  currentVersion?: string;
  version?: string;
  percent?: number;
  message?: string;
  reason?: "development" | "portable";
};

export type DesktopUpdates = {
  getLocalization?: () => Promise<{
    mode: AppLanguageMode;
    language: "en" | "es";
    locale: string;
    messages: Record<string, string>;
    fallbackMessages: Record<string, string>;
  }>;
  setLanguageMode?: (mode: AppLanguageMode) => Promise<{
    ok: boolean;
    changed?: boolean;
    restarted?: boolean;
  }>;
  getUpdateState: () => Promise<UpdateState>;
  checkForUpdates: () => Promise<UpdateState>;
  downloadUpdate: () => Promise<UpdateState>;
  installUpdate: () => Promise<{ ok: boolean }>;
  onUpdateState: (callback: (state: UpdateState) => void) => () => void;
  getReleaseNotesState?: () => Promise<{
    shouldShow: boolean;
    currentVersion: string;
    previousVersion: string | null;
  }>;
  acknowledgeReleaseNotes?: () => Promise<{ ok: boolean }>;
  listFarms: () => Promise<{
    activePath: string;
    farms: FarmOption[];
  }>;
  switchFarm: (savePath: string) => Promise<{ ok: boolean; busy?: boolean }>;
  openSettings: () => Promise<{ ok: boolean }>;
  getDiagnostics: () => Promise<DesktopDiagnostics>;
  copyText: (value: string) => Promise<{ ok: boolean }>;
  exportFarm: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>;
  setDisplayScale?: (scale: number) => Promise<{ ok: boolean; scale: number }>;
  onOpenHelp?: (callback: () => void) => () => void;
  onNavigateHistory?: (callback: (direction: "back" | "forward") => void) => () => void;
};

export type AppNavigationTarget = { view: ActiveView; section?: string };

export type DesktopDiagnostics = {
  version: string;
  packaged: boolean;
  development?: boolean;
  osVersion?: string;
  architecture?: string;
  gameFound: boolean;
  saveFound: boolean;
  smapiFound: boolean;
  bridgeInstalled: boolean;
  bridgeManifestFound?: boolean;
  bridgeVersion?: string | null;
  bridgeDllFound?: boolean;
  gameRunning?: boolean;
  liveStateFound?: boolean;
  liveStateFresh?: boolean;
  liveStateAgeSeconds?: number | null;
  modCompatibility?: ModCompatibilitySummary;
};

export type FarmOption = {
  name: string;
  farmer: string;
  avatar?: string;
  gameDate?: string;
  gameSeason?: string;
  gameDay?: number;
  gameYear?: number;
  path: string;
  modifiedAt: number;
  liveUpdatedAt?: number;
};

export type FeedbackKind = "bug" | "suggestion";

export type PlanningSection =
  | "community"
  | "calculators"
  | "crops"
  | "buildings"
  | "production"
  | "animals"
  | "friends"
  | "storage"
  | "goals";

export type SectionVisibilityOption = { id: string; label: string };
