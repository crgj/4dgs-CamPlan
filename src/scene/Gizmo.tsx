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
import { useRef, useEffect } from 'react';
import { TransformControls } from '@react-three/drei';
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

export function Gizmo({ target }: { target: AnyEntity }) {
  const mode = usePlanner((s) => s.view.transformMode);
  const snapEnabled = usePlanner((s) => s.view.snapToGrid);
  const snapStep = usePlanner((s) => s.view.snapStep);
  const updateTransform = usePlanner((s) => s.updateTransform);
  const commitHistory = usePlanner((s) => s.commitHistory);
  const setIsTransforming = usePlanner((s) => s.setIsTransforming);
  // T-027：世界/局部坐标系。local=gizmo 嵌在父级层级下（局部空间）；world=gizmo 直接世界空间。
  const gizmoSpace = usePlanner((s) => s.gizmoSpace);

  // gizmo 宿主：虚拟 Object3D，同步目标位姿
  const dummyRef = useRef<Object3D>(null!);
  useEffect(() => {
    const o = dummyRef.current;
    if (!o) return;
    const deg = (d: number) => (d * Math.PI) / 180;
    o.position.set(...target.transform.position);
    o.rotation.set(
      deg(target.transform.rotation[0]),
      deg(target.transform.rotation[1]),
      deg(target.transform.rotation[2]),
    );
    const sc = target.transform.scale ?? [1, 1, 1];
    o.scale.set(sc[0], sc[1], sc[2]);
  }, [target.id, target.transform]);

  const readBack = (): Transform => {
    const o = dummyRef.current;
    const e = o.rotation; // THREE.Euler
    return {
      position: [o.position.x, o.position.y, o.position.z],
      rotation: [(e.x * 180) / Math.PI, (e.y * 180) / Math.PI, (e.z * 180) / Math.PI],
      scale: [o.scale.x, o.scale.y, o.scale.z],
    };
  };

  // world 模式：gizmo 直接挂世界空间（不嵌父级），拖动结果即世界坐标；
  // 对无父级实体与 local 等价（绝大多数场景）；有父级时 readBack 转回局部。
  const hasParent = Boolean(target.parentId);
  const wrapper =
    gizmoSpace === 'local' && hasParent ? (
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
        rotationSnap={snapEnabled ? (snapStep * Math.PI) / 180 : null}
        scaleSnap={snapEnabled ? snapStep : null}
        onMouseDown={() => {
          // #WDD-gpt  2026-06-19 - gizmo 拖动期间暂停视口导航，避免 TransformControls 与 UnrealControls 抢输入
          setIsTransforming(true);
          commitHistory();
        }}
        onMouseUp={() => setIsTransforming(false)}
        onObjectChange={() => updateTransform(target.id, readBack(), false)}
      />
    </>
  );
}
