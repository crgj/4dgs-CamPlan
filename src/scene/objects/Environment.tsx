/**
 * 环境渲染（src/scene/objects/Environment.tsx）。
 * T-087：HDRI/IBL 支持——drei <Environment> 加载 HDR 作为环境光 + PMREM 预滤波反射。
 * 旧逻辑保留：环境光补光 + 地面平面。
 */
import { Environment as DreiEnv } from '@react-three/drei';
import type { EnvDef } from '@/types';

const HDRI_PRESETS: Record<string, string> = {
  studio: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/hdri/studio.hdr',
  city: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/hdri/city.hdr',
  sunset: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/hdri/sunset.hdr',
  warehouse: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/hdri/warehouse.hdr',
};

export function Environment({ env }: { env: EnvDef }) {
  const groundColor = `#${env.ground.color.toString(16).padStart(6, '0')}`;
  const hdriKey = env.hdri;
  const hdriUrl = hdriKey ? HDRI_PRESETS[hdriKey] ?? hdriKey : undefined;
  const fogColor = env.fog ? `#${env.fog.color.toString(16).padStart(6, '0')}` : undefined;
  const fogNear = env.fog ? Math.max(0, Math.min(env.fog.near, env.fog.far - 0.01)) : 0;
  const fogFar = env.fog ? Math.max(fogNear + 0.01, env.fog.far) : 1;

  return (
    <>
      {/* #WDD-gpt  2026-06-21 - Inspector 只写 env.fog；这里把它挂到 Three scene.fog，主视口材质才会实际参与雾化 */}
      {env.fog && <fog attach="fog" args={[fogColor ?? '#222222', fogNear, fogFar]} />}
      {/* T-087：HDRI 作为 IBL（环境光 + 反射），无 HDRI 时用基础环境光 + 补光方向光，
          否则空场景里只有 ambientLight(0.4)，PBR 模型（如 OBJ 人物）会几乎全黑看不见。 */}
      {hdriUrl ? (
        <DreiEnv files={hdriUrl} background={false} />
      ) : (
        <>
          <ambientLight intensity={env.ambientIntensity} />
          {/* 三点光照兜底：主光 + 补光，让无 HDRI 场景里的物体也能看清受光与纹理。
              不影响有 LightFixture 的场景（叠加即可），强度温和。 */}
          <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
          <directionalLight position={[-6, 4, -4]} intensity={0.4} />
        </>
      )}
      {env.ground.enabled && (
        <mesh
          name="Environment Ground"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, env.ground.y, 0]}
          receiveShadow
        >
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color={groundColor} envMapIntensity={0.5} />
        </mesh>
      )}
    </>
  );
}

export { HDRI_PRESETS };
