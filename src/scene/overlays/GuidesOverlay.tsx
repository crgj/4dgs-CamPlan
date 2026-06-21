/**
 * T-075 辅助线与尺寸标注叠加层（src/scene/overlays/GuidesOverlay.tsx）。
 *
 * 由 store.view.showGuides 开关（ViewportToolbar 切换）。开启时渲染：
 *   ① 世界原点 XYZ 轴（UE5 红/绿/蓝）—— 始终朝向参考
 *   ② 地面原点处的参考圆环带（半径可设，默认 2m，标示默认拍摄半径）
 *   ③ 选中主体的 W×H×D 尺寸标签（Billboard 朝向相机，附在边界框边线）
 *
 * #WDD-gpt 2026-06-21 - 取消地面 XY 十字标尺轴与刻度文字，改为地面圆环带（半径
 * 由 preferences.guideRingRadius 控制）。圆环带帮助快速判断「主体到相机/中心」的距离。
 *
 * 遵循现有 CoverageHeatmap/BoundsOverlay 模式：自读 store、关时返回 null、
 * 用 R3F 原语 + drei Line/Text/Billboard。数学复用 lib/aabb 的 aabbSize/aabbCenter。
 */
import { Line, Text, Billboard } from '@react-three/drei';
import { usePlanner } from '@/state/store';
import { aabbCenter, aabbSize } from '@/lib/aabb';

const AXIS_LEN = 3;
const COLORS = { x: '#c83838', y: '#4cae50', z: '#0a8fef' };

/**
 * 在地面 2m 格子点上显示压扁小圆球标记。
 * 条件：X 或 Z 坐标是 2 的倍数。
 * 范围：±8 米。
 */
function GridTickLabels({ groundY }: { groundY: number }) {
  const RANGE = 8;
  const STEP = 2;
  const points: { x: number; z: number }[] = [];

  for (let x = -RANGE; x <= RANGE; x += STEP) {
    for (let z = -RANGE; z <= RANGE; z += STEP) {
      if (x === 0 && z === 0) continue; // 原点不显示
      const isXMultiple = x !== 0 && x % STEP === 0;
      const isZMultiple = z !== 0 && z % STEP === 0;
      if (isXMultiple || isZMultiple) {
        points.push({ x, z });
      }
    }
  }

  return (
    <group>
      {points.map((p) => (
        <mesh key={`${p.x}-${p.z}`} position={[p.x, groundY + 0.005, p.z]} scale={[1, 0.01, 1]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#a0a0a0" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function GuidesOverlay() {
  const show = usePlanner((s) => s.view.showGuides);
  const groundY = usePlanner((s) => s.scene.env.ground.y);
  const scene = usePlanner((s) => s.scene);
  const selection = usePlanner((s) => s.selection);
  const ringRadius = usePlanner((s) => s.preferences.guideRingRadius);
  const ringTube = usePlanner((s) => s.preferences.guideRingTube);
  const ringColor = usePlanner((s) => s.preferences.gridSectionColor);

  if (!show) return null;

  // 选中主体（仅 subject 有 AABB 尺寸标注意义）
  const selectedId = selection.length > 0 ? selection[selection.length - 1] : null;
  const selectedSubject = selectedId
    ? scene.subjects.find((s) => s.id === selectedId && s.enabled) ?? null
    : null;

  return (
    <group>
      {/* ① 世界原点 XYZ 轴 */}
      <Line points={[[0, 0, 0], [AXIS_LEN, 0, 0]]} color={COLORS.x} lineWidth={2} />
      <Line points={[[0, 0, 0], [0, AXIS_LEN, 0]]} color={COLORS.y} lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, AXIS_LEN]]} color={COLORS.z} lineWidth={2} />

      {/* 地面 2m 格子点位置标注（X 或 Z 为 2 的倍数） */}
      <GridTickLabels groundY={groundY} />

      {/* ② 地面参考圆环带 */}
      <GuideRing
        radius={Math.max(0.05, ringRadius)}
        tube={Math.max(0.01, ringTube)}
        groundY={groundY}
        color={ringColor}
      />

      {/* ③ 选中主体尺寸标注 */}
      {selectedSubject && (
        <DimensionLabels
          center={[...aabbCenter(selectedSubject.bounds)] as [number, number, number]}
          size={[...aabbSize(selectedSubject.bounds)] as [number, number, number]}
        />
      )}
    </group>
  );
}

/**
 * 地面原点处的参考圆环带。
 * 用 TorusGeometry 绘制实心圆环带，半径与宽度均可设。
 */
function GuideRing({
  radius,
  tube,
  groundY,
  color,
}: {
  radius: number;
  tube: number;
  groundY: number;
  color: string;
}) {
  // 圆环中心略高于地面，Y 方向压扁为 0.01（扁平圆环带）
  const y = groundY + 0.005;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} scale={[1, 1, 0.01]}>
        <torusGeometry args={[radius, tube, 16, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* 半径标注（朝向相机的 Billboard，放在 +X 侧） */}
      <Billboard position={[radius + tube + 0.15, groundY + 0.1, 0]}>
        <Text
          fontSize={0.1}
          color="#ffffff"
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor="#101010"
        >
          {`r ${radius.toFixed(2)} m`}
        </Text>
      </Billboard>
    </group>
  );
}

/** 在边界框三条边线旁标注 W×H×D（朝向相机的 Billboard）。 */
function DimensionLabels({ center, size }: { center: [number, number, number]; size: [number, number, number] }) {
  const [cx, cy, cz] = center;
  const [w, h, d] = size;
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  return (
    <group>
      {/* 宽（X 边，前下方） */}
      <Billboard position={[cx, cy - hy - 0.15, cz + hz]}>
        <Text fontSize={0.13} color={COLORS.x} anchorX="center" anchorY="middle">
          {`W ${w.toFixed(2)} m`}
        </Text>
      </Billboard>
      {/* 高（Y 边，右侧） */}
      <Billboard position={[cx + hx + 0.15, cy, cz + hz]}>
        <Text fontSize={0.13} color={COLORS.y} anchorX="center" anchorY="middle">
          {`H ${h.toFixed(2)} m`}
        </Text>
      </Billboard>
      {/* 深（Z 边，顶右） */}
      <Billboard position={[cx + hx, cy + hy + 0.15, cz]}>
        <Text fontSize={0.13} color={COLORS.z} anchorX="center" anchorY="middle">
          {`D ${d.toFixed(2)} m`}
        </Text>
      </Billboard>
    </group>
  );
}
