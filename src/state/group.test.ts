// GroupDef 组合实体集成测试（src/state/group.test.ts）。
// 覆盖：addGroup / reparent 进 group / selectSubtree / 导出变换链经过 group。
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanner, type PlannerState } from './store';
import { resetDefaultCounters } from '@/lib/defaults';
import { exportToTransformsJson } from '@/export/transforms';

describe('GroupDef 组合实体', () => {
  beforeEach(() => {
    resetDefaultCounters();
    // 重置 store 到默认空场景
    usePlanner.getState().loadScene({ version: 1, cameras: [], lights: [], subjects: [], groups: [], env: { kind: 'environment', ambientIntensity: 0.4, ground: { enabled: true, y: 0, color: 0x222222 } } });
  });

  it('addGroup 创建组合并自动选中', () => {
    const s = usePlanner.getState();
    const g = s.addGroup();
    expect(g.kind).toBe('group');
    expect(g.transform.position).toEqual([0, 0, 0]);
    expect(usePlanner.getState().selection).toEqual([g.id]);
    expect(usePlanner.getState().scene.groups?.length).toBe(1);
  });

  it('reparent 把相机挂到 group 下（保持世界变换）', () => {
    const s = usePlanner.getState();
    const g = s.addGroup({ transform: { position: [5, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } });
    const cam = s.addCamera({ transform: { position: [5, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } });
    usePlanner.getState().reparent(cam.id, g.id, true);
    const updated = usePlanner.getState().scene.cameras.find((c) => c.id === cam.id);
    expect(updated?.parentId).toBe(g.id);
    // keepWorld: 相机世界位 [5,1,0]，group 在 [5,0,0]，所以局部 ~[0,1,0]
    expect(Math.abs(updated!.transform.position[0])).toBeLessThan(0.01);
    expect(updated!.transform.position[1]).toBeCloseTo(1, 1);
  });

  it('selectSubtree 选中组合及全部子代', () => {
    const s = usePlanner.getState();
    const g = s.addGroup();
    const cam = s.addCamera({ parentId: g.id });
    const light = s.addLight('point', { parentId: g.id });
    usePlanner.getState().selectSubtree(g.id);
    const sel = usePlanner.getState().selection;
    expect(sel).toContain(g.id);
    expect(sel).toContain(cam.id);
    expect(sel).toContain(light.id);
  });

  it('导出变换链：挂 group 的相机世界变换经过 group 平移', () => {
    const s = usePlanner.getState();
    const g = s.addGroup({ transform: { position: [10, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } });
    s.addCamera({ transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, parentId: g.id });
    const scene = usePlanner.getState().scene;
    const json = JSON.parse(exportToTransformsJson(scene));
    expect(json.frames.length).toBeGreaterThan(0);
    const c2w = json.frames[0].camera_to_world;
    // 相机世界位置在 camera_to_world 矩阵最后一列（x = c2w[0][3]）
    expect(Math.abs(c2w[0][3] - 10)).toBeLessThan(0.01);
  });

  it('removeEntity 删除 group', () => {
    const s = usePlanner.getState();
    const g = s.addGroup();
    usePlanner.getState().removeEntity(g.id);
    expect(usePlanner.getState().scene.groups?.find((x) => x.id === g.id)).toBeUndefined();
  });

  it('duplicateEntity 复制 group', () => {
    const s = usePlanner.getState();
    const g = s.addGroup({ name: 'MyGroup' });
    const newId = usePlanner.getState().duplicateEntity(g.id);
    expect(newId).not.toBeNull();
    const dup = usePlanner.getState().scene.groups?.find((x) => x.id === newId);
    expect(dup?.name).toContain('copy');
  });
});

// 规避未用导入
void (null as unknown as PlannerState);
