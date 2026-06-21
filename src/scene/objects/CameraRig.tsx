// WDD -gemini 2026-06-19 修复相机视锥辅助线位置错位的问题：将辅助线角点计算从世界空间重构为相机局部空间
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard, Text } from '@react-three/drei';
import type { CameraDef } from '@/types';
import { usePlanner } from '@/state/store';
import { verticalFovFromHorizontal } from '@/sim/frustum';

const ACCENT = '#0a8fef';
const DIM = '#6a8aa8';

// #WDD-gpt  2026-06-19 - 明确相机对象点击事件类型，移除显式 any
export function CameraRig({ cam, children, onClick }: { cam: CameraDef; children?: ReactNode; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const selected = usePlanner((s) => s.selection.includes(cam.id));
  const showFrustums = usePlanner((s) => s.view.showFrustums);
  // #WDD-gpt 2026-06-21 - 选中摄像机时始终显示其视锥，不受全局 showFrustums 开关影响
  const showThisFrustum = selected || showFrustums;
  // #WDD-gpt 2026-06-21 - 视口中显示摄像机名字 + 视场角
  const showGuides = usePlanner((s) => s.view.showGuides);
  // #WDD-gpt 2026-06-21 - 视锥绘制远端：用全局 frustumDrawDistance 限制视觉长度，
  // 不再用 cam.far（默认 1000，会画出超长锥）。取 min(真实 far, 绘制距离) 保证不超过真实裁剪。
  const drawFar = usePlanner((s) => Math.min(cam.far, s.preferences.frustumDrawDistance));

  // 8 角点：近面 4 + 远面 4（局部坐标，相机看向 -Z 轴）
  const corners = useMemo(() => {
    const fovYRad = verticalFovFromHorizontal(cam.fov, cam.aspect);
    const halfV = Math.tan(fovYRad / 2);
    const halfH = halfV * cam.aspect;

    const plane = (dist: number): [number, number, number][] => {
      const hw = halfH * dist;
      const hv = halfV * dist;
      return [
        [-hw, hv, -dist],
        [hw, hv, -dist],
        [hw, -hv, -dist],
        [-hw, -hv, -dist],
      ];
    };
    return [...plane(cam.near), ...plane(drawFar)];
  }, [cam.fov, cam.aspect, cam.near, drawFar]);

  const lineGeom = useMemo(() => {
    // 视锥线框：近面框、远面框、4 条侧棱
    const pts: THREE.Vector3[] = [];
    const [n0, n1, n2, n3, f0, f1, f2, f3] = corners.map(
      (c) => new THREE.Vector3(c[0], c[1], c[2])
    );
    // 近面
    pts.push(n0, n1, n1, n2, n2, n3, n3, n0);
    // 远面
    pts.push(f0, f1, f1, f2, f2, f3, f3, f0);
    // 侧棱
    pts.push(n0, f0, n1, f1, n2, f2, n3, f3);
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return g;
  }, [corners]);

  // 相机机身（小三角锥朝向 -Z，表示朝向）
  const bodyColor = selected ? '#48606f' : '#4b5663';
  const edgeColor = selected ? '#79cfff' : '#74818f';
  const redAccent = selected ? '#ff4141' : '#c51f2b';
  const glassColor = selected ? '#d7f0ff' : '#223446';

  return (
    <group position={cam.transform.position} rotation={[deg(cam.transform.rotation[0]), deg(cam.transform.rotation[1]), deg(cam.transform.rotation[2])]} onClick={onClick}>
      {/* #WDD-gpt  2026-06-21 - 摄像机实体原点就是镜头光心；Z CAM 风格方盒机身向本地 +Z 后移，视锥和仿真位置都从镜头中心出发 */}
      <group position={[0, 0, 0.17]}>
        <mesh>
          <boxGeometry args={[0.36, 0.27, 0.22]} />
          <meshStandardMaterial color={bodyColor} roughness={0.58} metalness={0.12} emissive={selected ? '#0a2b3d' : '#1a222b'} emissiveIntensity={selected ? 0.18 : 0.08} />
        </mesh>
        <mesh position={[0, 0.151, 0]}>
          <boxGeometry args={[0.3, 0.018, 0.18]} />
          <meshStandardMaterial color={edgeColor} roughness={0.5} metalness={0.25} />
        </mesh>
        <mesh position={[-0.191, 0, 0]}>
          <boxGeometry args={[0.016, 0.2, 0.16]} />
          <meshStandardMaterial color={edgeColor} roughness={0.55} metalness={0.22} />
        </mesh>
        <mesh position={[0.191, 0, 0]}>
          <boxGeometry args={[0.016, 0.2, 0.16]} />
          <meshStandardMaterial color={edgeColor} roughness={0.55} metalness={0.22} />
        </mesh>
        <mesh position={[-0.13, 0.075, -0.116]}>
          <boxGeometry args={[0.055, 0.032, 0.01]} />
          <meshStandardMaterial color={redAccent} roughness={0.32} metalness={0.08} emissive={redAccent} emissiveIntensity={selected ? 0.45 : 0.22} />
        </mesh>
        <mesh position={[0.13, -0.072, -0.116]}>
          <boxGeometry args={[0.045, 0.024, 0.01]} />
          <meshStandardMaterial color={redAccent} roughness={0.36} metalness={0.08} emissive={redAccent} emissiveIntensity={selected ? 0.32 : 0.16} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.118, 0.105, 0.12, 36]} />
        <meshStandardMaterial color={edgeColor} roughness={0.4} metalness={0.35} emissive={selected ? '#0a3950' : '#000000'} emissiveIntensity={selected ? 0.14 : 0.02} />
      </mesh>
      <mesh position={[0, 0, 0.002]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.088, 0.088, 0.026, 36]} />
        <meshStandardMaterial color="#2f3a45" roughness={0.28} metalness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.072, 0.072, 0.012, 32]} />
        <meshStandardMaterial color={glassColor} roughness={0.12} metalness={0.05} emissive={selected ? ACCENT : '#0b1a27'} emissiveIntensity={selected ? 0.35 : 0.18} />
      </mesh>
      <mesh position={[0, 0, -0.012]}>
        <torusGeometry args={[0.079, 0.006, 8, 32]} />
        <meshStandardMaterial color={redAccent} roughness={0.28} metalness={0.18} emissive={redAccent} emissiveIntensity={selected ? 0.28 : 0.12} />
      </mesh>

      {/* #WDD-gpt 2026-06-21 - 摄像机名字 + 视场角标签（Billboard 朝向视口相机） */}
      {showGuides && (
        <Billboard position={[0, 0.32, 0.14]}>
          <Text
            fontSize={0.13}
            color={selected ? ACCENT : '#cfd6e0'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.006}
            outlineColor="#0a0c10"
          >
            {`${cam.name}  ${cam.fov.toFixed(0)}°`}
          </Text>
        </Billboard>
      )}

      {showThisFrustum && (
        <lineSegments
          geometry={lineGeom}
          raycast={() => {
            // #WDD-gpt  2026-06-20 - 相机视锥是辅助显示，不参与选中命中，避免点视锥误选相机
          }}
        >
          <lineBasicMaterial color={selected ? ACCENT : DIM} transparent opacity={selected ? 0.9 : 0.5} />
        </lineSegments>
      )}

      {selected && (
        <mesh position={[0, 0.02, 0.1]}>
          <boxGeometry args={[0.44, 0.34, 0.42]} />
          <meshBasicMaterial color={ACCENT} wireframe />
        </mesh>
      )}

      {children}
    </group>
  );
}

const deg = (d: number) => (d * Math.PI) / 180;
