/**
 * T-025 Bounds 视图模式 overlay（src/scene/overlays/BoundsOverlay.tsx）。
 * 显示所有启用主体的世界空间 AABB 边界框（线框），便于布局对齐。
 * 仅在 viewMode === 'bounds' 时渲染。
 */
import { usePlanner } from '@/state/store';
import { aabbCenter, aabbSize } from '@/lib/aabb';

export function BoundsOverlay() {
  const viewMode = usePlanner((s) => s.viewMode);
  const subjects = usePlanner((s) => s.scene.subjects);

  if (viewMode !== 'bounds') return null;

  return (
    <>
      {subjects
        .filter((s) => s.enabled)
        .map((s) => {
          const center = aabbCenter(s.bounds);
          const size = aabbSize(s.bounds);
          return (
            <mesh key={s.id} position={[center[0], center[1], center[2]]}>
              <boxGeometry args={[size[0], size[1], size[2]]} />
              <meshBasicMaterial color="#0a8fef" wireframe />
            </mesh>
          );
        })}
    </>
  );
}
