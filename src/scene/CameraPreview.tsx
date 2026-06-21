/**
 * 相机预览视图（src/scene/CameraPreview.tsx）。
 *
 * #WDD-gpt 2026-06-21 - 在摄像机 Details 面板里嵌入一个「从该相机看出去」的小型实时预览。
 * 随相机参数（transform / fov / aspect / near / far / resolution）变化实时更新。
 *
 * 实现：一个嵌套的 R3F <Canvas>（独立 GL 上下文），其渲染相机位姿/投影与所选 CameraDef
 * 完全一致；场景里复用场景主体（SubjectMesh，含 USDZ/OBJ 模型）+ 环境补光，让用户看到
 * 「这台相机拍到的画面」。挂在 Inspector 的 renderCameraGroup 顶部。
 *
 * 注意：嵌套 <Canvas> 会复用 USDLoader 的 R3F 缓存（按 src），与主视口共享同一份解析
 * 结果，但每实例独立 parse（见 SubjectMesh 的 UsdSubjectModel），所以不会互相争用。
 */
import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera as DreiPerspectiveCamera } from '@react-three/drei';
import type { CameraDef, EnvDef, SubjectDef } from '@/types';
import { usePlanner } from '@/state/store';
import { SubjectMesh } from './objects/SubjectMesh';
import { verticalFovFromHorizontal } from '@/sim/frustum';
import { deg2rad } from '@/lib/math';

const deg = (d: number) => deg2rad(d);

/**
 * 渲染相机：完全按 CameraDef 的位姿 + 投影对齐。
 * 用 drei <PerspectiveCamera makeDefault> 声明式设置 position/rotation/fov/aspect/near/far，
 * 参数变化时 React 重渲染即自动更新投影——无需命令式改 hook 返回值（避开 lint 规则）。
 */
function PreviewCamera({ cam }: { cam: CameraDef }) {
  // 透视相机：fov 用垂直 fov（CameraDef.fov 是水平度，按 aspect 换算）
  const fovY = verticalFovFromHorizontal(cam.fov, cam.aspect);
  return (
    <DreiPerspectiveCamera
      makeDefault
      fov={(fovY * 180) / Math.PI}
      aspect={cam.aspect}
      near={cam.near}
      far={cam.far}
      position={[cam.transform.position[0], cam.transform.position[1], cam.transform.position[2]]}
      rotation={[
        deg(cam.transform.rotation[0]),
        deg(cam.transform.rotation[1]),
        deg(cam.transform.rotation[2]),
      ]}
    />
  );
}

/**
 * 预览场景主体 + 环境补光（与主视口一致的基础三光照兜底，保证 PBR 模型不黑）。
 * #WDD-gpt 2026-06-21 - 显示与主视口一致的地面（env.ground 平面 + 颜色），而非仅 gridHelper。
 */
function PreviewSceneContent({ subjects, env }: { subjects: SubjectDef[]; env: EnvDef }) {
  const groundColor = useMemo(
    () => `#${env.ground.color.toString(16).padStart(6, '0')}`,
    [env.ground.color],
  );
  const groundY = env.ground.enabled ? env.ground.y : 0;
  const lights = useMemo(
    () => (
      <>
        <ambientLight intensity={env.ambientIntensity} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-6, 4, -4]} intensity={0.4} />
        <hemisphereLight args={[0xffffff, 0x444466, 0.6]} />
      </>
    ),
    [env.ambientIntensity],
  );
  return (
    <>
      {lights}
      {/* 地面：与主视口 Environment.tsx 一致（env.ground 平面 + 颜色） */}
      {env.ground.enabled && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, groundY, 0]}
          receiveShadow
        >
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color={groundColor} envMapIntensity={0.5} />
        </mesh>
      )}
      {/* 地面网格线参考（叠加在地面上方一点，避免 z-fight，让相机画面有空间感） */}
      <gridHelper args={[40, 40, 0x3a3f45, 0x2a2e33]} position={[0, groundY + 0.001, 0]} />
      {subjects.map((s) => (
        <SubjectMesh key={s.id} subject={s} />
      ))}
    </>
  );
}

/**
 * 相机预览容器。给定 CameraDef，渲染一个按其 aspect 定比例的小 Canvas。
 * 尺寸自适应外层宽度（高度 = 宽 / aspect）。
 */
export function CameraPreview({ cam }: { cam: CameraDef }) {
  const subjects = usePlanner((s) => s.scene.subjects);
  const env = usePlanner((s) => s.scene.env);
  const aspect = cam.aspect > 0 ? cam.aspect : 16 / 9;

  return (
    <div className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-sm border border-[var(--color-panel-border)] bg-black"
        style={{ aspectRatio: `${aspect}` }}
      >
        <Canvas
          shadows={false}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            preserveDrawingBuffer: false,
            alpha: false,
            powerPreference: 'low-power',
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x16181c, 1);
          }}
        >
          <Suspense fallback={null}>
            <PreviewCamera cam={cam} />
            <PreviewSceneContent subjects={subjects} env={env} />
          </Suspense>
        </Canvas>
        {/* 分辨率与 FOV 标注 */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-between px-1.5 py-0.5 text-[10px] font-mono text-white/60 bg-black/40">
          <span>
            {cam.resolution.width}×{cam.resolution.height}
          </span>
          <span>{cam.fov.toFixed(0)}°</span>
        </div>
      </div>
    </div>
  );
}
