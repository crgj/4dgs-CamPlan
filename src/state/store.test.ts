import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanner, snap } from './store';
import { resetDefaultCounters } from '@/lib/defaults';

beforeEach(() => {
  resetDefaultCounters();
  usePlanner.getState().resetScene();
  usePlanner.setState({ history: { past: [], future: [] } });
});

describe('store / 增删实体', () => {
  it('addCamera 加入并自动选中', () => {
    const cam = usePlanner.getState().addCamera();
    const st = usePlanner.getState();
    expect(st.scene.cameras).toHaveLength(1);
    expect(st.scene.cameras[0].id).toBe(cam.id);
    expect(st.selection).toEqual([cam.id]);
  });
  it('addLight/addSubject 各自归类', () => {
    usePlanner.getState().addLight('spot');
    usePlanner.getState().addSubject();
    const st = usePlanner.getState();
    expect(st.scene.lights).toHaveLength(1);
    expect(st.scene.lights[0].lightKind).toBe('spot');
    expect(st.scene.subjects).toHaveLength(1);
  });
  it('removeEntity 跨类删除并清选择', () => {
    const c = usePlanner.getState().addCamera();
    usePlanner.getState().select(c.id);
    usePlanner.getState().removeEntity(c.id);
    const st = usePlanner.getState();
    expect(st.scene.cameras).toHaveLength(0);
    expect(st.selection).toHaveLength(0);
  });
  it('removeEntities 批量删除并只产生一个撤销步骤', () => {
    const cam = usePlanner.getState().addCamera();
    const light = usePlanner.getState().addLight('point');
    const subject = usePlanner.getState().addSubject();
    usePlanner.getState().selectMany([cam.id, light.id, subject.id]);
    const before = usePlanner.getState().history.past.length;

    usePlanner.getState().removeEntities([cam.id, light.id, subject.id]);

    const st = usePlanner.getState();
    expect(st.scene.cameras).toHaveLength(0);
    expect(st.scene.lights).toHaveLength(0);
    expect(st.scene.subjects).toHaveLength(0);
    expect(st.selection).toHaveLength(0);
    expect(st.history.past.length).toBe(before + 1);
  });
  it('duplicateEntity 复制相机并偏移、新 id', () => {
    const c = usePlanner.getState().addCamera();
    const newId = usePlanner.getState().duplicateEntity(c.id);
    expect(newId).not.toBeNull();
    const st = usePlanner.getState();
    expect(st.scene.cameras).toHaveLength(2);
    expect(st.scene.cameras[1].id).toBe(newId);
    expect(st.scene.cameras[1].id).not.toBe(c.id);
  });
});

describe('store / 选择', () => {
  it('select 单选替换', () => {
    const a = usePlanner.getState().addCamera();
    const b = usePlanner.getState().addCamera();
    usePlanner.getState().select(a.id);
    expect(usePlanner.getState().selection).toEqual([a.id]);
    usePlanner.getState().select(b.id);
    expect(usePlanner.getState().selection).toEqual([b.id]);
  });
  it('additive 多选/取消', () => {
    const a = usePlanner.getState().addCamera();
    const b = usePlanner.getState().addCamera();
    usePlanner.getState().select(a.id);
    usePlanner.getState().select(b.id, true);
    expect(usePlanner.getState().selection).toHaveLength(2);
    usePlanner.getState().select(a.id, true); // 再点取消
    expect(usePlanner.getState().selection).toEqual([b.id]);
  });
  it('selectedEntity 返回最后选中', () => {
    const a = usePlanner.getState().addCamera();
    usePlanner.getState().select(a.id);
    expect(usePlanner.getState().selectedEntity()?.id).toBe(a.id);
  });
  it('clearSelection', () => {
    const a = usePlanner.getState().addCamera();
    usePlanner.getState().select(a.id);
    usePlanner.getState().clearSelection();
    expect(usePlanner.getState().selection).toHaveLength(0);
  });
  it('selected camera viewport commands', () => {
    const cam = usePlanner.getState().addCamera();
    usePlanner.getState().viewSelectedCameraViewport();
    expect(usePlanner.getState().view.viewportCommand).toMatchObject({
      kind: 'viewCamera',
      cameraId: cam.id,
    });

    usePlanner.getState().setSelectedCameraFromViewport();
    expect(usePlanner.getState().view.viewportCommand).toMatchObject({
      kind: 'setCameraFromViewport',
      cameraId: cam.id,
    });
  });
});

describe('store / 更新', () => {
  it('updateCamera 改字段', () => {
    const c = usePlanner.getState().addCamera();
    usePlanner.getState().updateCamera(c.id, { fov: 90 });
    expect(usePlanner.getState().scene.cameras[0].fov).toBe(90);
  });
  it('updateSubject 改 transform → bounds 重算', () => {
    const s = usePlanner.getState().addSubject();
    const before = usePlanner.getState().scene.subjects[0].bounds;
    usePlanner.getState().updateSubject(s.id, {
      transform: { position: [5, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    });
    const after = usePlanner.getState().scene.subjects[0].bounds;
    expect(after.min[0]).not.toBe(before.min[0]);
    expect(after.min[0]).toBeCloseTo(4.5, 5);
  });
  it('updateTransform 改相机位姿', () => {
    const c = usePlanner.getState().addCamera();
    usePlanner.getState().updateTransform(c.id, { position: [1, 2, 3], rotation: [0, 0, 0] });
    const cam = usePlanner.getState().scene.cameras[0];
    expect(cam.transform.position).toEqual([1, 2, 3]);
  });
  it('renameEntity', () => {
    const c = usePlanner.getState().addCamera();
    usePlanner.getState().renameEntity(c.id, 'Hero Cam');
    expect(usePlanner.getState().scene.cameras[0].name).toBe('Hero Cam');
  });
});

describe('store / 撤销重做', () => {
  it('addCamera 后 undo 撤回', () => {
    usePlanner.getState().addCamera();
    expect(usePlanner.getState().scene.cameras).toHaveLength(1);
    usePlanner.getState().undo();
    expect(usePlanner.getState().scene.cameras).toHaveLength(0);
  });
  it('undo 后 redo 恢复', () => {
    usePlanner.getState().addCamera();
    usePlanner.getState().undo();
    usePlanner.getState().redo();
    expect(usePlanner.getState().scene.cameras).toHaveLength(1);
  });
  it('canUndo/canRedo 状态正确', () => {
    expect(usePlanner.getState().canUndo()).toBe(false);
    usePlanner.getState().addCamera();
    expect(usePlanner.getState().canUndo()).toBe(true);
    expect(usePlanner.getState().canRedo()).toBe(false);
    usePlanner.getState().undo();
    expect(usePlanner.getState().canRedo()).toBe(true);
  });
  it('新改动清空 future', () => {
    usePlanner.getState().addCamera();
    usePlanner.getState().undo();
    expect(usePlanner.getState().canRedo()).toBe(true);
    usePlanner.getState().addCamera(); // 新改动
    expect(usePlanner.getState().canRedo()).toBe(false);
  });
  it('updateTransform(withHistory=false) 不入栈', () => {
    const c = usePlanner.getState().addCamera();
    usePlanner.getState().undo(); // 撤回 add，回到空
    usePlanner.getState().addCamera(); // 重新加一个
    const before = usePlanner.getState().history.past.length;
    usePlanner.getState().updateTransform(c.id, { position: [9, 9, 9], rotation: [0, 0, 0] }, false);
    expect(usePlanner.getState().history.past.length).toBe(before);
  });
});

describe('store / 场景级', () => {
  it('loadScene 替换并清历史/选择', () => {
    usePlanner.getState().addCamera();
    const newScene = {
      version: 1,
      cameras: [],
      lights: [],
      subjects: [],
      env: usePlanner.getState().scene.env,
    };
    usePlanner.getState().loadScene(newScene);
    expect(usePlanner.getState().scene.cameras).toHaveLength(0);
    expect(usePlanner.getState().canUndo()).toBe(false);
  });
  it('resetScene 回到默认空场景', () => {
    usePlanner.getState().addCamera();
    usePlanner.getState().resetScene();
    expect(usePlanner.getState().scene.cameras).toHaveLength(0);
  });
});

describe('store / 视图（不入历史）', () => {
  it('toggleCoverageHeatmap 切换', () => {
    const v0 = usePlanner.getState().view.showCoverageHeatmap;
    usePlanner.getState().toggleCoverageHeatmap();
    expect(usePlanner.getState().view.showCoverageHeatmap).toBe(!v0);
  });
  it('setTransformMode', () => {
    usePlanner.getState().setTransformMode('rotate');
    expect(usePlanner.getState().view.transformMode).toBe('rotate');
  });
  it('RMB 相机导航状态不入场景历史', () => {
    const before = usePlanner.getState().history.past.length;
    expect(usePlanner.getState().view.isCameraNavigating).toBe(false);
    usePlanner.getState().setIsCameraNavigating(true);
    expect(usePlanner.getState().view.isCameraNavigating).toBe(true);
    usePlanner.getState().setIsCameraNavigating(false);
    expect(usePlanner.getState().view.isCameraNavigating).toBe(false);
    expect(usePlanner.getState().history.past.length).toBe(before);
  });
  it('snap 工具', () => {
    expect(snap(1.3, 0.5, true)).toBe(1.5);
    expect(snap(1.3, 0.5, false)).toBe(1.3);
  });
  it('focusSelectedViewport 为选中实体创建聚焦命令', () => {
    const subject = usePlanner.getState().addSubject();
    usePlanner.getState().select(subject.id);
    usePlanner.getState().focusSelectedViewport();
    const command = usePlanner.getState().view.viewportCommand;
    expect(command?.kind).toBe('focus');
    if (command?.kind === 'focus') {
      expect(command.distance).toBeGreaterThan(0);
      expect(command.target).toHaveLength(3);
    }
  });
  it('resetViewportCamera 创建复位命令', () => {
    usePlanner.getState().resetViewportCamera();
    expect(usePlanner.getState().view.viewportCommand?.kind).toBe('reset');
  });
});
