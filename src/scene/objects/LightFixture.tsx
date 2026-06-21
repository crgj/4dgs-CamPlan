/**
 * 灯光可视化（src/scene/objects/LightFixture.tsx）。
 * 参考 UE5.8：点光源显示半径球、聚光灯显示锥体、方向光显示方向箭头。
 * 同时把 Three 灯光挂上去（实际照明）。
 */
import type { ReactNode } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { LightDef } from '@/types';
import { usePlanner } from '@/state/store';

const ACCENT = '#0a8fef';
const DIM = '#9aa84a';

// #WDD-gpt  2026-06-19 - 明确灯光对象点击事件类型，移除显式 any
export function LightFixture({ light, children, onClick }: { light: LightDef; children?: ReactNode; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const selected = usePlanner((s) => s.selection.includes(light.id));
  const color = selected ? ACCENT : DIM;
  const deg = (d: number) => (d * Math.PI) / 180;
  const rot: [number, number, number] = [
    deg(light.transform.rotation[0]),
    deg(light.transform.rotation[1]),
    deg(light.transform.rotation[2]),
  ];

  return (
    <group position={light.transform.position} rotation={rot} onClick={onClick}>
      {/* 图标球（始终显示，标识位置） */}
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color={light.enabled ? `#${light.color.toString(16).padStart(6, '0')}` : '#555'} />
      </mesh>

      {/* 实际 Three 灯光 */}
      {light.lightKind === 'point' && light.enabled && (
        <pointLight
          color={`#${light.color.toString(16).padStart(6, '0')}`}
          intensity={light.intensity / 50}
          distance={light.range ?? 0}
          decay={2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0005}
        />
      )}
      {light.lightKind === 'spot' && light.enabled && (
        <>
          <spotLight
            color={`#${light.color.toString(16).padStart(6, '0')}`}
            intensity={light.intensity / 50}
            distance={light.range ?? 0}
            angle={deg(light.spotAngle ?? 45)}
            penumbra={light.spotPenumbra ?? 0.2}
            decay={2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0005}
          />
          {/* 聚光锥可视化 */}
          <mesh>
            <coneGeometry args={[Math.tan(deg(light.spotAngle ?? 45)) * (light.range ?? 5), light.range ?? 5, 16, 1, true]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
          </mesh>
        </>
      )}
      {light.lightKind === 'directional' && light.enabled && (
        <>
          <directionalLight
            color={`#${light.color.toString(16).padStart(6, '0')}`}
            intensity={light.intensity}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
            shadow-bias={-0.0005}
          />
          {/* 方向箭头（朝 -Z） */}
          <mesh position={[0, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.25, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        </>
      )}

      {selected && (
        <mesh>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial color={ACCENT} wireframe />
        </mesh>
      )}

      {children}
    </group>
  );
}
