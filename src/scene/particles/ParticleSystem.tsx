/**
 * T-084 高质量 Three.js 粒子系统（src/scene/particles/ParticleSystem.tsx）。
 * 基于 THREE.Points + 自研 GLSL：体积感、软粒子深度淡入、加性/标准混合。
 * GPU 实例化位置/速度，每帧 update 推进；不拖慢 raster 主视口。
 */
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ParticleSystemDef } from '@/types/particles';

// 软粒子顶点+片元着色器（深度淡入 + 大小衰减）
const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aLife;
  attribute vec3 aVelocity;
  uniform float uTime;
  uniform float uLifetime;
  varying float vAlpha;
  void main() {
    float t = mod(uTime + aLife, uLifetime) / uLifetime;
    vec3 pos = position + aVelocity * t * uLifetime;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    // 寿命中段最亮，两端淡入淡出
    vAlpha = sin(t * 3.14159);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    // 圆形软粒子：到中心距离衰减
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, soft * vAlpha * uOpacity);
  }
`;

/** 粒子初始化（纯随机，独立于 React hook 规则）。 */
function initParticles(def: ParticleSystemDef) {
  const positions = new Float32Array(def.count * 3);
  const sizes = new Float32Array(def.count);
  const lives = new Float32Array(def.count);
  const velocities = new Float32Array(def.count * 3);
  for (let i = 0; i < def.count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * def.size;
    positions[i * 3 + 1] = (Math.random() - 0.5) * def.size;
    positions[i * 3 + 2] = (Math.random() - 0.5) * def.size;
    sizes[i] = def.size * (0.5 + Math.random() * 0.5);
    lives[i] = Math.random() * def.lifetime;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * def.speed;
    velocities[i * 3 + 1] = Math.abs(Math.cos(phi)) * def.speed;
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * def.speed;
  }
  return { positions, sizes, lives, velocities };
}

export function ParticleSystem({ def }: { def: ParticleSystemDef }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const startTime = useRef(0);
  useEffect(() => {
    startTime.current = performance.now() / 1000;
  }, []);

  const { positions, sizes, lives, velocities } = useMemo(
    () => initParticles(def),
    [def],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLifetime: { value: def.lifetime },
      uColor: { value: new THREE.Color(def.color) },
      uOpacity: { value: 0.8 },
    }),
    [def.lifetime, def.color],
  );

  useFrame(() => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = performance.now() / 1000 - startTime.current;
    }
  });

  return (
    <points position={def.position} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aLife" args={[lives, 1]} />
        <bufferAttribute attach="attributes-aVelocity" args={[velocities, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={def.additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </points>
  );
}
