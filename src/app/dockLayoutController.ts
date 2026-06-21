export type DockPanelId = 'content' | 'outliner' | 'details' | 'stats' | 'render' | 'library';

interface DockLayoutController {
  togglePanel: (panelId: DockPanelId) => void;
  isPanelVisible: (panelId: DockPanelId) => boolean;
}

let controller: DockLayoutController | null = null;
const listeners = new Set<() => void>();

export function setDockLayoutController(next: DockLayoutController | null) {
  controller = next;
  for (const listener of listeners) listener();
}

export function toggleDockPanel(panelId: DockPanelId) {
  controller?.togglePanel(panelId);
  for (const listener of listeners) listener();
}

export function notifyDockLayoutChanged() {
  for (const listener of listeners) listener();
}

export function isDockPanelVisible(panelId: DockPanelId): boolean {
  return controller?.isPanelVisible(panelId) ?? true;
}

export function subscribeDockLayout(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
