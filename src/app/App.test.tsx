import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Dockview/R3F 依赖 ResizeObserver/WebGL，jsdom 不提供。
 * 因此把 DockLayout 整体 mock 成占位，只验证应用外壳布局（顶栏/底栏/面板占位）。
 * 真实 3D 交互由 Playwright E2E（见 PLAN.md M3/M6）覆盖。
 */
vi.mock('@/app/DockLayout', () => ({
  DockLayout: () => <div data-testid="dock-layout-stub" />,
}));

import { App } from '@/app/App';

describe('App', () => {
  it('渲染顶栏标题', () => {
    render(<App />);
    expect(screen.getByText('CamPlan')).toBeTruthy();
  });

  it('挂载 DockLayout 编辑器区', () => {
    render(<App />);
    expect(screen.getByTestId('dock-layout-stub')).toBeTruthy();
  });
});
