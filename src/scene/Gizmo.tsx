/**
 * 选择 + TransformControls gizmo（src/scene/Gizmo.tsx）。
 * 参考 UE5.8（见 ue5-ui-reference §6）：选中单实体挂 gizmo，W/E/R 切模式。
 *
 * 历史节流（planner-conventions）：
 *   mouseDown → commitHistory()（把“拖动前”快照入栈）
 *   拖动中   → updateTransform(withHistory=false) 实时回写，不入栈
 *   mouseUp  → 不操作
 * → 一次拖拽 = 一个可撤销步骤。
 */
import { useRef, useEffect, useMemo } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Object3D } from 'three';
import { usePlanner } from '@/state/store';
import type { AnyEntity, Transform } from '@/types';

// WDD -gemini 2026-06-19 新增父级级联组件，将 Gizmo 的虚拟 Object3D 嵌套在父物体层级下，确保 Gizmo 操作的坐标系为局部空间 (Local Space)
function ParentTransformWrapper({ parentId, children }: { parentId: string; children: React.ReactNode }) {
  const scene = usePlanner((s) => s.scene);
  const allEntities = [
    ...scene.cameras,
    ...scene.lights,
    ...scene.subjects,
    ...(scene.groups ?? []),
  ];
  const parent = allEntities.find((e) => e.id === parentId);
  if (!parent) return <>{children}</>;

  const pos = parent.transform.position;
  const rot = parent.transform.rotation;
  const scl = parent.transform.scale || [1, 1, 1];
  const degToRad = (d: number) => (d * Math.PI) / 180;
  const radRot: [number, number, number] = [
    degToRad(rot[0]),
    degToRad(rot[1]),
    degToRad(rot[2]),
  ];

  return (
    <group position={pos as [number, number, number]} rotation={radRot} scale={scl as [number, number, number]}>
      <ParentTransformWrapper parentId={parent.parentId || ''}>
        {children}
      </ParentTransformWrapper>
    </group>
  );
}

export function Gizmo({ target, selection }: { target: AnyEntity; selection?: AnyEntity[] }) {
  const mode = usePlanner((s) => s.view.transformMode);
  const snapEnabled = usePlanner((s) => s.view.snapToGrid);
  const snapStep = usePlanner((s) => s.view.snapStep);
  // #WDD-gpt 2026-06-21 - 旋转捕捉独立步长（度），与位置步长区分
  const rotationSnapStep = usePlanner((s) => s.view.rotationSnapStep);
  const updateTransform = usePlanner((s) => s.updateTransform);
  const commitHistory = usePlanner((s) => s.commitHistory);
  const setIsTransforming = usePlanner((s) => s.setIsTransforming);
  // T-027：世界/局部坐标系。local=gizmo 嵌在父级层级下（局部空间）；world=gizmo 直接世界空间。
  const gizmoSpace = usePlanner((s) => s.gizmoSpace);

  // #WDD-gpt 2026-06-21 - 多选模式：selection 长度 > 1 时启用，gizmo 位于多选质心，
  // 拖动/旋转时把「质心位姿增量」按各自的偏移应用到所有选中实体（一起移动/一起旋转）。
  const isMulti = !!selection && selection.length > 1;

  // 质心 = 选中实体位置的平均；质心初始旋转 = 0（世界对齐），多选旋转围绕质心。
  const centroid = useMemo<[number, number, number]>(() => {
    if (!selection || selection.length === 0) return [0, 0, 0];
    const n = selection.length;
    const sum = selection.reduce(
      (acc, e) => [acc[0] + e.transform.position[0], acc[1] + e.transform.position[1], acc[2] + e.transform.position[2]],
      [0, 0, 0],
    );
    return [sum[0] / n, sum[1] / n, sum[2] / n];
  }, [selection]);

  // gizmo 宿主：虚拟 Object3D，同步目标位姿
  const dummyRef = useRef<Object3D>(null!);
  // 多选拖动前快照：每个实体相对质心的偏移 + 自身旋转，用于计算拖动后新位姿。
  const preDragRef = useRef<{ centroid: THREE.Vector3; quat: THREE.Quaternion; ents: { id: string; offset: THREE.Vector3; rotQuat: THREE.Quaternion }[] } | null>(null);

  useEffect(() => {
    const o = dummyRef.current;
    if (!o) return;
    const deg = (d: number) => (d * Math.PI) / 180;
    if (isMulti) {
      // 多选：dummy 定位在质心，初始旋转 0（世界对齐）
      o.position.set(...centroid);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
    } else {
      o.position.set(...target.transform.position);
      o.rotation.set(
        deg(target.transform.rotation[0]),
        deg(target.transform.rotation[1]),
        deg(target.transform.rotation[2]),
      );
      const sc = target.transform.scale ?? [1, 1, 1];
      o.scale.set(sc[0], sc[1], sc[2]);
    }
  }, [target.id, target.transform, isMulti, centroid]);

  const readBack = (): Transform => {
    const o = dummyRef.current;
    const e = o.rotation; // THREE.Euler
    return {
      position: [o.position.x, o.position.y, o.position.z],
      rotation: [(e.x * 180) / Math.PI, (e.y * 180) / Math.PI, (e.z * 180) / Math.PI],
      scale: [o.scale.x, o.scale.y, o.scale.z],
    };
  };

  /**
   * 多选拖动/旋转回写：计算质心 dummy 的位姿增量，按每个实体拖动前的偏移重新定位。
   * - 平移：每个实体 = 新质心 +（拖动前 offset 按质心旋转增量旋转）
   * - 旋转：每个实体的旋转 = 质心旋转增量 × 拖动前自身旋转
   * 这样多选「一起移动 + 一起旋转」且保持相对布局。
   */
  const applyMultiDelta = () => {
    const snap = preDragRef.current;
    const o = dummyRef.current;
    if (!snap || !o || !selection) return;
    const newCenter = new THREE.Vector3(o.position.x, o.position.y, o.position.z);
    const newQuat = new THREE.Quaternion().setFromEuler(o.rotation);
    // 质心旋转增量 = newQuat * inverse(初始 quat)
    const deltaQuat = newQuat.clone().multiply(snap.quat.clone().invert());
    for (const ent of snap.ents) {
      // 新位置 = 新质心 + deltaQuat * 旧偏移
      const rotatedOffset = ent.offset.clone().applyQuaternion(deltaQuat);
      const newPos = newCenter.clone().add(rotatedOffset);
      // 新旋转 = deltaQuat * 旧自身旋转
      const newRotQuat = deltaQuat.clone().multiply(ent.rotQuat);
      const e = new THREE.Euler().setFromQuaternion(newRotQuat, 'XYZ');
      const t: Transform = {
        position: [newPos.x, newPos.y, newPos.z],
        rotation: [(e.x * 180) / Math.PI, (e.y * 180) / Math.PI, (e.z * 180) / Math.PI],
        scale: [1, 1, 1],
      };
      updateTransform(ent.id, t, false);
    }
  };

  // world 模式：gizmo 直接挂世界空间（不嵌父级）；多选强制世界空间（各实体父级不同）。
  const hasParent = Boolean(target.parentId);
  const useLocalWrapper = !isMulti && gizmoSpace === 'local' && hasParent;
  const wrapper =
    useLocalWrapper ? (
      <ParentTransformWrapper parentId={target.parentId || ''}>
        <object3D ref={dummyRef} />
      </ParentTransformWrapper>
    ) : (
      <object3D ref={dummyRef} />
    );

  return (
    <>
      {wrapper}
      <TransformControls
        object={dummyRef as unknown as Object3D}
        mode={mode}
        translationSnap={snapEnabled ? snapStep : null}
        rotationSnap={snapEnabled ? (rotationSnapStep * Math.PI) / 180 : null}
        scaleSnap={snapEnabled ? snapStep : null}
        onMouseDown={() => {
          // #WDD-gpt  2026-06-19 - gizmo 拖动期间暂停视口导航，避免 TransformControls 与 UnrealControls 抢输入
          setIsTransforming(true);
          commitHistory();
          // #WDD-gpt 2026-06-21 - 多选拖动前快照：质心位姿 + 每个实体的相对偏移/自身旋转
          if (isMulti && selection && dummyRef.current) {
            const o = dummyRef.current;
            const center = new THREE.Vector3(o.position.x, o.position.y, o.position.z);
            const quat = new THREE.Quaternion().setFromEuler(o.rotation);
            preDragRef.current = {
              centroid: center,
              quat,
              ents: selection.map((e) => ({
                id: e.id,
                offset: new THREE.Vector3(
                  e.transform.position[0] - center.x,
                  e.transform.position[1] - center.y,
                  e.transform.position[2] - center.z,
                ),
                rotQuat: new THREE.Quaternion().setFromEuler(
                  new THREE.Euler(
                    (e.transform.rotation[0] * Math.PI) / 180,
                    (e.transform.rotation[1] * Math.PI) / 180,
                    (e.transform.rotation[2] * Math.PI) / 180,
                  ),
                ),
              })),
            };
          }
        }}
        onMouseUp={() => {
          setIsTransforming(false);
          preDragRef.current = null;
        }}
        onObjectChange={() => {
          if (isMulti) applyMultiDelta();
          else updateTransform(target.id, readBack(), false);
        }}
      />
    </>
  );
}
