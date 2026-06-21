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
  const bodyColor = selected ? ACCENT : DIM;

  return (
    <group position={cam.transform.position} rotation={[deg(cam.transform.rotation[0]), deg(cam.transform.rotation[1]), deg(cam.transform.rotation[2])]} onClick={onClick}>
      {/* 机身：小立方 + 前伸锥（朝 -Z） */}
      <mesh>
        <boxGeometry args={[0.25, 0.25, 0.4]} />
        <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={selected ? 0.5 : 0.2} />
      </mesh>
      {/* 镜头朝向指示（-Z 方向小锥） */}
      <mesh position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.2, 12]} />
        <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={0.3} />
      </mesh>

      {/* #WDD-gpt 2026-06-21 - 摄像机名字 + 视场角标签（Billboard 朝向视口相机） */}
      {showGuides && (
        <Billboard position={[0, 0.32, 0]}>
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

      {showFrustums && (
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
        <mesh>
          <boxGeometry args={[0.35, 0.35, 0.5]} />
          <meshBasicMaterial color={ACCENT} wireframe />
        </mesh>
      )}

      {children}
    </group>
  );
}

const deg = (d: number) => (d * Math.PI) / 180;
