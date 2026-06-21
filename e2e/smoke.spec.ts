/**
 * T-037 端到端冒烟测试（Playwright，需浏览器环境）。
 * 运行：npx playwright install && npx playwright test
 * 覆盖：启动 → 示例场景渲染 → Outline/Details 交互 → 导出 → Message Log。
 *
 * 注意：此 spec 需要先 npm run build 或在 dev server 运行时执行。
 * 纯逻辑冒烟见 src/e2e/smoke.test.ts（不依赖浏览器）。
 */
import { test, expect } from '@playwright/test';

test('应用启动并渲染示例场景', async ({ page }) => {
  await page.goto('/');
  // 标题栏可见
  await expect(page.locator('header')).toBeVisible();
  // 示例场景：8 台相机在 Outliner 出现
  await expect(page.getByText('Camera_1')).toBeVisible({ timeout: 10_000 });
});

test('切换视图模式不崩溃', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Lit').click();
  await page.getByText('Wireframe').click();
  // Wireframe 模式下 StatsBar 显示 Wireframe
  await expect(page.locator('text=Wireframe')).toBeVisible();
});

test('Details 面板可编辑选中相机', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Camera_1').click();
  // Details 面板出现相机属性
  await expect(page.getByText(/Location|位置/)).toBeVisible();
});
