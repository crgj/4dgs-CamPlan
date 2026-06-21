/**
 * 全局键盘快捷键（src/io/useKeyboard.ts）。
 * 参考 UE5.8（见 ue5-ui-reference §6 / scene-edit-interactions 快捷键表）。
 * 在 App 顶层挂一次（useEffect）。
 *
 * W/E/R gizmo 模式 · Delete 删除 · Ctrl+D 复制 · Ctrl+Z/Y 撤销重做
 * · 1/2/3/4 视图 · F 聚焦(占位) · Space 切热图 · G 切捕捉
 */
import { useEffect } from 'react';
import { usePlanner } from '@/state/store';

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 输入框内不触发（避免编辑数值时误删）
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      const s = usePlanner.getState();
      const ctrl = e.ctrlKey || e.metaKey;

      // #WDD-gpt  2026-06-20 - RMB 视口飞行导航期间，键盘只驱动 UnrealControls 的相机移动，不触发编辑快捷键
      if (s.view.isCameraNavigating) return;

      // 组合编辑：Esc 退出隔离编辑（优先级最高，避免编辑数值时误触）
      if (e.key === 'Escape' && s.editingGroupId) {
        s.exitGroupEdit();
        return;
      }

      // 撤销/重做
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      // 复制（Ctrl+D：原地复制单个；Ctrl+C/Ctrl+V：复制到剪贴板后粘贴，支持多选）
      if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (s.selection.length > 0) s.duplicateEntity(s.selection[s.selection.length - 1]);
        return;
      }
      // #WDD-gpt 2026-06-21 - Ctrl+C 复制选中到剪贴板；Ctrl+V 粘贴（生成新 id，偏移 +1m）
      if (ctrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        s.copySelection();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        s.pasteSelection();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          s.setTransformMode('translate');
          break;
        case 'e':
          s.setTransformMode('rotate');
          break;
        case 'r':
          s.setTransformMode('scale');
          break;
        case 'g':
          s.toggleSnap();
          break;
        case 'f':
          // #WDD-gpt  2026-06-21 - 选中摄像机时 F 捕捉主视口到该摄像机，否则保持原 UE 风聚焦选中实体
          if (s.selection.length > 0 && s.scene.cameras.some((cam) => cam.id === s.selection[s.selection.length - 1])) {
            s.viewSelectedCameraViewport();
          } else {
            s.focusSelectedViewport();
          }
          break;
        case 'c':
          // #WDD-gpt  2026-06-21 - 选中摄像机时 C 将该摄像机设置到当前主视口位姿
          if (s.selection.length > 0 && s.scene.cameras.some((cam) => cam.id === s.selection[s.selection.length - 1])) {
            s.setSelectedCameraFromViewport();
          }
          break;
        case 'home':
          // #WDD-gpt  2026-06-19 - 实现 Home 复位视口快捷键
          s.resetViewportCamera();
          break;
        case ' ':
          e.preventDefault();
          s.toggleCoverageHeatmap();
          break;
        case '1':
          s.setProjection('perspective');
          break;
        case '2':
          s.setProjection('top');
          break;
        case '3':
          s.setProjection('front');
          break;
        case '4':
          s.setProjection('side');
          break;
        case 'delete':
        case 'backspace':
          // #WDD-gpt  2026-06-19 - Delete/Backspace 删除全部选中实体，而不是只删最后一个
          if (s.selection.length > 0) s.removeEntities(s.selection);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
