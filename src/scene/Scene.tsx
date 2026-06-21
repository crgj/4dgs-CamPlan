/**
 * 3D 视口场景装配（src/scene/Scene.tsx）。
 * 参考 UE5.8（见 ue5-ui-reference §3/§6）：视口含网格、坐标轴、所有实体可视化、
 * 选中 gizmo。导航：UnrealControls 飞越式漫游（右键Look Around，WASD/QE飞行，中键平移）。
 * 状态全部来自 store；本组件只做“数据→Three 对象”映射。
 */
import { useEffect } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { usePlanner } from '@/state/store';
import { Environment } from './objects/Environment';
import { CameraRig } from './objects/CameraRig';
import { LightFixture } from './objects/LightFixture';
import { SubjectMesh } from './objects/SubjectMesh';
import { Gizmo } from './Gizmo';
import { CoverageHeatmap } from './overlays/CoverageHeatmap';
import { BoundsOverlay } from './overlays/BoundsOverlay';
import { GuidesOverlay } from './overlays/GuidesOverlay';
import { PostFXStack } from './post/PostFXStack';
import { PathTracerPreview } from './pathtracing/PathTracerPreview';
import { UnrealControls } from './UnrealControls';
import { RenderRuntimeSync } from './RenderRuntimeSync';
import { resolvePixelRatio, qualityHasShadows } from './RenderQuality';
import type { AnyEntity } from '@/types';
import { clearViewportDropPoint, setViewportDropPoint } from '@/io/dropTarget';

function ViewportDropRaycaster({ groundY }: { groundY: number }) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const dom = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
    const hit = new THREE.Vector3();

    const hasPlannerPayload = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types ?? []);
      return types.includes('application/x-planner-prototype') || types.includes('application/x-planner-asset');
    };

    const updateDropPoint = (e: DragEvent) => {
      if (!hasPlannerPayload(e)) return;
      const rect = dom.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      );
      raycaster.setFromCamera(ndc, camera);
      // #WDD-gpt  2026-06-20 - 只计算鼠标射线与无限地面平面交点，忽略地面之外所有物体和对象
      if (raycaster.ray.intersectPlane(plane, hit)) {
        setViewportDropPoint([hit.x, hit.y, hit.z]);
      } else {
        clearViewportDropPoint();
      }
    };

    const clearDropPoint = (e: DragEvent) => {
      if (hasPlannerPayload(e)) clearViewportDropPoint();
    };

    dom.addEventListener('dragover', updateDropPoint);
    dom.addEventListener('dragleave', clearDropPoint);
    return () => {
      dom.removeEventListener('dragover', updateDropPoint);
      dom.removeEventListener('dragleave', clearDropPoint);
    };
  }, [camera, gl, groundY]);

  return null;
}

// WDD -gemini 2026-06-19 重构为支持父子层级嵌套的三维实体渲染树，子物体跟随父物体运动旋转
function Entities() {
  const scene = usePlanner((s) => s.scene);
  const selection = usePlanner((s) => s.selection);
  const select = usePlanner((s) => s.select);
  const editingGroupId = usePlanner((s) => s.editingGroupId);

  const selectedId = selection.length > 0 ? selection[selection.length - 1] : null;
  const selectedEntity = selectedId
    ? scene.cameras.find((c) => c.id === selectedId) ??
      scene.lights.find((l) => l.id === selectedId) ??
      scene.subjects.find((m) => m.id === selectedId) ??
      (scene.groups ?? []).find((g) => g.id === selectedId) ??
      null
    : null;

  const allEntities = [
    ...scene.cameras,
    ...scene.lights,
    ...scene.subjects,
    ...(scene.groups ?? []),
  ];

  // #WDD-gpt 2026-06-21 - 多选：把全部选中实体传给 gizmo，gizmo 位于质心，一起移动/旋转。
  const selectedEntities = selection
    .map((id) => allEntities.find((e) => e.id === id) ?? null)
    .filter((e): e is AnyEntity => e !== null);
  const isMulti = selectedEntities.length > 1;

  // 递归渲染实体节点树
  // #WDD-gpt  2026-06-19 - 用实体联合类型和 R3F 事件类型替代 any，降低选择链路风险
  const renderEntityNode = (entity: AnyEntity) => {
    // #WDD-gpt  2026-06-20 - enabled=false 的实体在视口中真正隐藏，并且不参与 raycast/选中
    if (!entity.enabled) return null;
    const children = allEntities.filter((e) => e.parentId === entity.id && e.enabled);
    const childNodes = children.map((child) => renderEntityNode(child));

    const handleSelect = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      select(entity.id);
    };

    if (entity.kind === 'camera') {
      return (
        <CameraRig key={entity.id} cam={entity} onClick={handleSelect}>
          {childNodes}
        </CameraRig>
      );
    }
    if (entity.kind === 'light') {
      return (
        <LightFixture key={entity.id} light={entity} onClick={handleSelect}>
          {childNodes}
        </LightFixture>
      );
    }
    if (entity.kind === 'subject') {
      return (
        <SubjectMesh key={entity.id} subject={entity} onClick={handleSelect}>
          {childNodes}
        </SubjectMesh>
      );
    }
    // group：纯 transform 容器节点（无几何），子节点继承其变换
    if (entity.kind === 'group') {
      return (
        <group
          key={entity.id}
          position={entity.transform.position}
          rotation={[
            (entity.transform.rotation[0] * Math.PI) / 180,
            (entity.transform.rotation[1] * Math.PI) / 180,
            (entity.transform.rotation[2] * Math.PI) / 180,
          ]}
          scale={entity.transform.scale ?? [1, 1, 1]}
        >
          {childNodes}
        </group>
      );
    }
    return null;
  };

  // 隔离编辑模式：只渲染被编辑组合的子树；否则渲染全部根实体
  let visibleRoots: AnyEntity[];
  if (editingGroupId) {
    const editingGroup = (scene.groups ?? []).find((g) => g.id === editingGroupId && g.enabled);
    visibleRoots = editingGroup ? [editingGroup] : [];
  } else {
    visibleRoots = allEntities.filter((e) => {
      if (!e.enabled) return false;
      if (!e.parentId) return true;
      return !allEntities.some((parent) => parent.id === e.parentId && parent.enabled);
    });
  }

  return (
    <>
      <Environment env={scene.env} />
      <CoverageHeatmap />
      <BoundsOverlay />
      <GuidesOverlay />

      {visibleRoots.map((e) => renderEntityNode(e))}

      {/* 选中实体的 gizmo（单选：挂在目标实体；多选：挂在质心，一起移动/旋转） */}
      {selectedEntity && <Gizmo target={selectedEntity} selection={isMulti ? selectedEntities : undefined} />}
    </>
  );
}

export function Scene() {
  const scene = usePlanner((s) => s.scene);
  const projection = usePlanner((s) => s.view.projection);
  const quality = usePlanner((s) => s.renderSettings.quality);
  const gridSectionSize = usePlanner((s) => s.preferences.gridSectionSize);
  const gridSectionThickness = usePlanner((s) => s.preferences.gridSectionThickness);
  const gridCellColor = usePlanner((s) => s.preferences.gridCellColor);
  const gridSectionColor = usePlanner((s) => s.preferences.gridSectionColor);
  // 4 视图：顶/前/侧用正交近似（这里通过相机位置表达；正交相机列 v2，先调透视位姿）
  const camPos: [number, number, number] =
    projection === 'top'
      ? [0, 20, 0.001]
      : projection === 'front'
        ? [0, 0.5, 20]
        : projection === 'side'
          ? [20, 0.5, 0]
          : [6, 5, 8];

  // T-088：把质量预设真正施加到 Canvas——DPR 与阴影开关。
  // 修复 bug：此前 LightFixture.castShadow / Environment receiveShadow 全设了，
  // 但 Canvas 从未启用 shadowMap.enabled，软阴影形同虚设；draft 质量也从未降 DPR。
  // shadowMap 分辨率由各光源自身的 shadow-mapSize-width/height 决定（见 LightFixture），
  // Canvas 的 shadows 只负责启用阴影系统。
  // 用 'percentage' (PCFShadowMap)：'soft' (PCFSoftShadowMap) 在新版 three 已废弃，
  // 会打印 "PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."
  const dpr = resolvePixelRatio(quality);
  const enableShadows = qualityHasShadows(quality);

  return (
    <Canvas
      camera={{ position: camPos, fov: 50, near: 0.1, far: 1000 }}
      className="bg-[var(--color-canvas-bg)]"
      dpr={dpr}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      shadows={enableShadows ? 'percentage' : false}
      onPointerMissed={(e) => {
        // #WDD-gpt  2026-06-20 - 空白左键取消选择；右键/中键保留给相机控制
        if (e.button === 0) usePlanner.getState().select(null);
      }}
    >
      <Entities />
      <RenderRuntimeSync />
      <PostFXStack />
      <PathTracerPreview />
      <ViewportDropRaycaster groundY={scene.env.ground.y} />

      {/* 地面网格 —— 色调参考 UE5.8（见 ue5-ui-reference），Y 轴微移 0.01 避免与地面重叠 Z-fighting */}
      <Grid
        position={[0, scene.env.ground.y + 0.01, 0]}
        args={[20, 20]}
        cellSize={Math.max(0.05, gridSectionSize / 5)}
        cellThickness={0.7}
        cellColor={gridCellColor}
        sectionSize={gridSectionSize}
        sectionThickness={gridSectionThickness}
        sectionColor={gridSectionColor}
        fadeDistance={55}
        fadeStrength={0.75}
        followCamera={false}
        infiniteGrid
        side={THREE.DoubleSide}
      />

      {/* #WDD-gpt  2026-06-20 - 视角导航必须在后处理之后渲染，避免与 EffectComposer 默认 priority=1 互相覆盖导致消失 */}
      <GizmoHelper alignment="bottom-right" margin={[54, 54]} renderPriority={2}>
        <GizmoViewport axisColors={['#c83838', '#4cae50', '#0a8fef']} labelColor="#c0c0c0" />
      </GizmoHelper>

      {/* #WDD -gemini 2026-06-19 替换 OrbitControls 为 Unreal Controls 漫游组件 */}
      <UnrealControls />
    </Canvas>
  );
}
