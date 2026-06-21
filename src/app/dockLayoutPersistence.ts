import type { DockviewApi } from 'dockview';

export const DOCK_LAYOUT_STORAGE_KEY = 'planner.dockview.layout.v3';

const LEGACY_DOCK_LAYOUT_STORAGE_KEY = 'planner.dockview.layout.v2';
const DOCK_LAYOUT_VERSION = 3;
const KNOWN_PANEL_COMPONENTS = new Set(['content', 'outliner', 'viewport', 'details', 'stats', 'placeholder']);

export type SerializedDockLayout = ReturnType<DockviewApi['toJSON']>;

interface StoredDockLayout {
  version: typeof DOCK_LAYOUT_VERSION;
  savedAt: string;
  layout: SerializedDockLayout;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasKnownPanelComponents(layout: SerializedDockLayout): boolean {
  return Object.values(layout.panels).every((panel) => KNOWN_PANEL_COMPONENTS.has(panel.contentComponent ?? panel.id));
}

function isSerializedDockLayout(value: unknown): value is SerializedDockLayout {
  if (!isRecord(value) || !isRecord(value.grid) || !isRecord(value.panels)) return false;
  const grid = value.grid;
  return typeof grid.width === 'number' && typeof grid.height === 'number' && isRecord(grid.root);
}

function parseStoredLayout(raw: string | null): SerializedDockLayout | null {
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (isRecord(parsed) && parsed.version === DOCK_LAYOUT_VERSION && isSerializedDockLayout(parsed.layout)) {
    return parsed.layout;
  }
  if (isSerializedDockLayout(parsed)) {
    return parsed;
  }
  return null;
}

export function readDockLayout(): SerializedDockLayout | null {
  try {
    const layout = parseStoredLayout(localStorage.getItem(DOCK_LAYOUT_STORAGE_KEY));
    if (layout && hasKnownPanelComponents(layout)) return layout;
    const legacyLayout = parseStoredLayout(localStorage.getItem(LEGACY_DOCK_LAYOUT_STORAGE_KEY));
    if (legacyLayout && hasKnownPanelComponents(legacyLayout)) return legacyLayout;
  } catch {
    clearDockLayout();
  }
  return null;
}

export function writeDockLayout(layout: SerializedDockLayout) {
  const payload: StoredDockLayout = {
    version: DOCK_LAYOUT_VERSION,
    savedAt: new Date().toISOString(),
    layout,
  };
  localStorage.setItem(DOCK_LAYOUT_STORAGE_KEY, JSON.stringify(payload));
}

export function clearDockLayout() {
  localStorage.removeItem(DOCK_LAYOUT_STORAGE_KEY);
  localStorage.removeItem(LEGACY_DOCK_LAYOUT_STORAGE_KEY);
}

export function resetDockLayout() {
  clearDockLayout();
  window.location.reload();
}
