import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDockLayout,
  DOCK_LAYOUT_STORAGE_KEY,
  readDockLayout,
  type SerializedDockLayout,
  writeDockLayout,
} from './dockLayoutPersistence';

const LEGACY_DOCK_LAYOUT_STORAGE_KEY = 'planner.dockview.layout.v2';

function makeLayout(component = 'viewport'): SerializedDockLayout {
  return ({
    grid: {
      root: { type: 'leaf', data: { views: ['viewport'], activeView: 'viewport', id: 'group_1' }, size: 600 },
      width: 1200,
      height: 800,
      orientation: 0,
    },
    panels: {
      viewport: {
        id: 'viewport',
        contentComponent: component,
        title: 'Viewport',
      },
    },
    activeGroup: 'group_1',
  } as unknown) as SerializedDockLayout;
}

describe('dockLayoutPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and restores the versioned Dockview layout', () => {
    const layout = makeLayout();
    writeDockLayout(layout);

    expect(readDockLayout()).toEqual(layout);
    expect(JSON.parse(localStorage.getItem(DOCK_LAYOUT_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: 3,
      layout: { grid: { width: 1200, height: 800 } },
    });
  });

  it('can read the legacy v2 layout shape (version-bumped fallback)', () => {
    const layout = makeLayout();
    localStorage.setItem(LEGACY_DOCK_LAYOUT_STORAGE_KEY, JSON.stringify(layout));

    expect(readDockLayout()).toEqual(layout);
  });

  it('rejects layouts that reference unknown panel components', () => {
    localStorage.setItem(DOCK_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 3, savedAt: 'now', layout: makeLayout('missing') }));

    expect(readDockLayout()).toBeNull();
  });

  it('clears current and legacy layout records together', () => {
    localStorage.setItem(DOCK_LAYOUT_STORAGE_KEY, '{}');
    localStorage.setItem(LEGACY_DOCK_LAYOUT_STORAGE_KEY, '{}');

    clearDockLayout();

    expect(localStorage.getItem(DOCK_LAYOUT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_DOCK_LAYOUT_STORAGE_KEY)).toBeNull();
  });
});
