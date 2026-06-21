/**
 * 主体可视化（src/scene/objects/SubjectMesh.tsx）。
 * box/sphere/plane 渲染对应几何；mesh 引用 OBJ+MTL 模型。
 *
 * OBJ 模型加载修复（2026-06-20）：
 *   - MTLLoader 异步加载纹理存在竞态——OBJLoader clone 后贴图可能未绑定。
 *     用 TextureLoader 显式加载 map_Kd/map_bump 并在 clone 后强制注入材质。
 *   - MTL 默认产出 MeshPhongMaterial，暗光下几乎全黑。升级为 MeshStandardMaterial
 *     (PBR)，配合 Environment IBL 与场景灯光正确受光。
 *   - 模型原点可能不在脚底：把 geometry 居中并下移使脚踩地面（OBJ 原点居中后，
 *     再平移使最低点 y=0）。
 */
import { useEffect, useMemo, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useLoader, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';
import type { SubjectDef, Vec3 } from '@/types';
import { usePlanner } from '@/state/store';

const ACCENT = '#0a8fef';
const DIM = '#6a7a8a';

/** 解析 OBJ 路径对应的资源目录与贴图。 */
function parseObjPaths(src: string) {
  const dir = src.slice(0, src.lastIndexOf('/') + 1);
  const mtlSrc = src.replace(/\.obj$/i, '.mtl');
  return { dir, mtlSrc };
}

/**
 * 同步解析 MTL 文本，提取漫反射(map_Kd)与法线/bump 贴图文件名。
 * 纯字符串解析，不发起网络请求——避免 MTLLoader 的 baseUrl 路径解析陷阱。
 * 返回相对文件名（需拼上 obj 目录）。
 */
function parseMtlTextures(mtlText: string): { mapKd?: string; mapBump?: string } {
  const lines = mtlText.split('\n');
  let mapKd: string | undefined;
  let mapBump: string | undefined;
  for (const raw of lines) {
    const line = raw.trim();
    // map_Kd 可能有前缀选项，最后一个 token 是文件名
    const tokens = line.split(/\s+/);
    const key = tokens[0]?.toLowerCase();
    const file = tokens[tokens.length - 1];
    if (key === 'map_kd' && file) mapKd = file;
    else if ((key === 'map_bump' || key === 'bump' || key === 'norm') && file) mapBump = file;
  }
  return { mapKd, mapBump };
}

/** 无条件加载贴图；文件名缺失时用占位 URL，加载失败兜底返回 null（不阻断渲染）。 */
function useOptionalTexture(url: string | null): THREE.Texture | null {
  // 用一个稳定占位：缺失时加载一个 1x1 透明（data:）避免 404 抛错
  const effectiveUrl = url ?? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
  const tex = useLoader(THREE.TextureLoader, effectiveUrl);
  return url ? tex : null;
}

function ObjSubjectModel({ src }: { src: string }) {
  const { dir, mtlSrc } = parseObjPaths(src);

  // 用 FileLoader 取 MTL 文本，解析出贴图文件名（map_Kd 漫反射 / map_bump 法线）。
  // 绕过 MTLLoader 的 baseUrl 路径陷阱：setResourcePath 设的是 materialManager.resourcePath
  // （OBJLoader 用），但 MTLLoader 内部 loadTexture 用 this.baseUrl（setPath 设），
  // 两者不同 → 贴图请求落到错误 URL → 404 → 无纹理。所以自己解析 + 自己加载。
  const mtlText = useLoader(THREE.FileLoader, mtlSrc) as unknown as string;
  const tex = parseMtlTextures(typeof mtlText === 'string' ? mtlText : String(mtlText));

  // 显式用 TextureLoader 加载贴图（绝对 public 路径 = obj 目录 + 文件名）
  const diffuseMap = useOptionalTexture(tex.mapKd ? `${dir}${tex.mapKd}` : null);
  const normalMap = useOptionalTexture(tex.mapBump ? `${dir}${tex.mapBump}` : null);

  // 只用 OBJLoader 加载几何（不带材质），材质我们自己造 PBR 的。
  const object = useLoader(OBJLoader, src);

  const prepared = useMemo(() => {
    const clone = object.clone(true);
    // 共享一份 PBR 材质（漫反射贴图 + 法线贴图），所有 mesh 复用
    const mat = new THREE.MeshStandardMaterial({
      map: diffuseMap,
      normalMap,
      roughness: 0.7,
      metalness: 0.0,
    });
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = mat;
      }
    });
    return clone;
  }, [object, diffuseMap, normalMap]);

  // 几何居中 + 脚踩地面：OBJ 原点未必在脚底，算 Box3 平移。
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(prepared);
    const center = box.getCenter(new THREE.Vector3());
    prepared.position.set(-center.x, -box.min.y, -center.z);
    prepared.updateMatrix();
  }, [prepared]);

  return <primitive object={prepared} />;
}

/**
 * USD/USDz 模型加载（src/scene/objects/SubjectMesh.tsx）。
 *
 * #WDD-gpt  2026-06-20 - 修复「第二次拖入角色 → 两个合并成一个 + 位置错；后来又改不渲染」
 *
 * 根因（合并/不显示）：useLoader(USDLoader, src) 返回的是 R3F 按 src 缓存的**同一个**
 * THREE.Object3D 实例，原先 <primitive object={object}> 直接复用它。Three.js 场景图中
 * 一个 Object3D 只能有一个 parent：第二次挂载会把模型从第一个实例偷走 → 两个 React 实例
 * 争用同一对象，视觉合并成一个 + 各自 wrapper group 互相覆盖 transform → 位置错乱；第一次
 * 也可能在加载完成后被第二次抢走而「不出现」。
 *
 * 为何不能 clone：USDLoader 输出的 USDZ 内部层级/纹理/骨架绑定用 object.clone(true) 和
 * SkeletonUtils.clone() 克隆后都会**不再渲染**（实测，见日志 16:40 回滚记录）。所以无法靠
 * 克隆给每个实例造独立副本。
 *
 * 解法（不 clone）：用 useLoader(FileLoader) **只缓存原始 ArrayBuffer（网络部分昂贵）**，
 * 每个实例在 useMemo 里用 USDLoader().parse(buffer) 同步**重新解析**出各自独立的 Group。
 * 这样每个拖入实例拥有独立的 Object3D（各自几何/材质/父节点），既不互相争用、也无需 clone。
 *
 * #WDD-gpt  2026-06-20 - 修正 USDZ 资产原始比例/原点不一致导致的不可见或尺寸错误
 * USDLoader 输出尺寸/原点取决于资产作者，不能假设已经是米制、脚底在原点。
 * 这里不修改 loader 返回对象的 transform，只在外层 group 做统一比例归一化：
 *   - bbox 的高度作为期望场景高度（米），避免三轴非等比缩放拉伸人物
 *   - 模型中心对齐到局部 X/Z 原点
 *   - 模型最低点对齐到局部 Y=0
 * 这样拖到地面时不会因为原始坐标过大/偏移而看不到。
 */
function UsdSubjectModel({ src, animate, animationClip, bbox }: { src: string; animate?: boolean; animationClip?: string; bbox?: Vec3 }) {
  const invalidate = useThree((s) => s.invalidate);
  // 只缓存原始字节（跨实例共享，避免重复网络下载）；ArrayBuffer 本身不含 Three 对象、可安全共享。
  // 必须设 responseType=arraybuffer，否则 FileLoader 默认返回文本，USDLoader.parse 会失败。
  const buffer = useLoader(THREE.FileLoader, src, (loader) => {
    (loader as THREE.FileLoader).setResponseType('arraybuffer');
  }) as unknown as ArrayBuffer;

  // 每个实例独立解析出一份全新的 Group（不共享 Object3D，不 clone）。
  // #WDD-gpt 2026-06-21 - 修复 USDZ SkinnedMesh 动画不播放：USDLoader 输出的 bone
  // 被嵌套在 SkinnedMesh 内部作为 child，而 AnimationMixer 要求 bone 是场景图独立节点。
  // 这里把 bone 从 SkinnedMesh 中解绑，挂到 bone 的原始父级（_rootJoint 或 skin0），
  // 让 mixer 能正确遍历和更新 bone transform。
  const object = useMemo(() => {
    const parsed = new USDLoader().parse(buffer);
    parsed.updateMatrixWorld(true);

    // 收集所有 SkinnedMesh 及其 skeleton
    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    parsed.traverse((child) => {
      if (child.type === 'SkinnedMesh') {
        skinnedMeshes.push(child as THREE.SkinnedMesh);
      }
    });

    for (const sm of skinnedMeshes) {
      if (!sm.skeleton) continue;
      const rootBone = sm.skeleton.bones[0];
      if (!rootBone) continue;
      // 如果 rootBone 的 parent 是 SkinnedMesh，需要把它移到 SkinnedMesh 的 parent 下
      if (rootBone.parent === sm) {
        const boneParent = sm.parent;
        if (boneParent) {
          // 从 SkinnedMesh 中移除
          sm.remove(rootBone);
          // 挂到 SkinnedMesh 的 parent 下，保持世界 transform
          boneParent.add(rootBone);
        }
      }
    }

    parsed.updateMatrixWorld(true);
    return parsed;
  }, [buffer]);

  const fit = useMemo(() => {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return { scale: [1, 1, 1] as Vec3, offset: [0, 0, 0] as Vec3 };
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const fallbackHeight = bbox?.[1] ?? 1.7;
    // #WDD-gpt  2026-06-20 - USDZ 视觉缩放必须保持等比，避免人物被 bbox 三轴强制拉伸
    const uniform = size.y > 0.0001 ? fallbackHeight / size.y : 1;
    const scale: Vec3 = [uniform, uniform, uniform];
    const offset: Vec3 = [
      -center.x * scale[0],
      -box.min.y * scale[1],
      -center.z * scale[2],
    ];
    return { scale, offset };
  }, [object, bbox]);

  useEffect(() => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // #WDD-gpt  2026-06-20 - USDZ/SkinnedMesh 的包围球经常与骨骼或上游 transform 不一致，避免被视锥裁剪成“已加载但不可见”
        child.frustumCulled = false;
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            mat.side = THREE.DoubleSide;
            mat.needsUpdate = true;
          });
        } else if (child.material) {
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      }
    });
    // #WDD-gpt  2026-06-20 - USDComposer 的贴图 Image.onload 是异步的，解析后与下一帧都显式刷新视口
    invalidate();
    const raf = window.requestAnimationFrame(() => invalidate());
    return () => window.cancelAnimationFrame(raf);
  }, [object, invalidate]);

  // 动画：USDLoader 把 clips 放在 object.animations。对**本实例**对象建 mixer 独立播放。
  // #WDD-gpt 2026-06-21 - 支持多 clip 切换：根据 animationClip prop 选择对应 clip。
  const mixer = useMemo(() => {
    const clips = (object as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations;
    if (!animate || !clips || clips.length === 0) return null;
    const m = new THREE.AnimationMixer(object);
    return m;
  }, [object, animate]);

  // 根据 animationClip 切换当前播放的 clip
  useEffect(() => {
    if (!mixer) return;
    const clips = (object as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations;
    if (!clips || clips.length === 0) return;

    // 停掉所有当前播放的 action
    mixer.stopAllAction();

    // 选择 clip：优先 animationClip 匹配，否则首个
    let targetClip = clips[0];
    if (animationClip) {
      const matched = clips.find((c) => c.name === animationClip);
      if (matched) targetClip = matched;
    }

    const action = mixer.clipAction(targetClip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.play();
  }, [mixer, object, animationClip]);

  useEffect(() => {
    // 组件卸载时停掉 mixer，避免动画继续驱动已卸载对象（多实例时关键）
    return () => {
      mixer?.stopAllAction();
    };
  }, [mixer]);

  useFrame((_, delta) => {
    if (mixer) mixer.update(delta);
  });

  return (
    <group position={fit.offset} scale={fit.scale}>
      <primitive object={object} />
    </group>
  );
}

/** 按扩展名选择模型加载器：.usdz/.usda/.usdc → USDLoader；.obj → OBJ+MTL 自定义。 */
function MeshModel({ src, animate, animationClip, bbox }: { src: string; animate?: boolean; animationClip?: string; bbox?: Vec3 }) {
  const ext = src.slice(src.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'usdz' || ext === 'usda' || ext === 'usdc') {
    return <UsdSubjectModel src={src} animate={animate} animationClip={animationClip} bbox={bbox} />;
  }
  return <ObjSubjectModel src={src} />;
}

// #WDD-gpt  2026-06-19 - 明确主体对象点击事件类型，移除显式 any
export function SubjectMesh({ subject, children, onClick }: { subject: SubjectDef; children?: ReactNode; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const selected = usePlanner((s) => s.selection.includes(subject.id));
  // T-025：wireframe 视图模式让主体显示线框
  const viewMode = usePlanner((s) => s.viewMode);
  const color = selected ? ACCENT : DIM;
  const wireframe = viewMode === 'wireframe';
  // #WDD-gpt  2026-06-20 - 主体默认应为实体材质，避免 Lit 模式下盒子看起来半透明
  const materialProps = { color, transparent: false, opacity: 1, wireframe };
  const deg = (d: number) => (d * Math.PI) / 180;
  // #WDD-gpt  2026-06-20 - 修复主体不参与阴影管线导致灯光/阴影看起来无效
  const meshShadowProps = { castShadow: true, receiveShadow: true };

  return (
    <group position={subject.transform.position} rotation={[deg(subject.transform.rotation[0]), deg(subject.transform.rotation[1]), deg(subject.transform.rotation[2])]} scale={subject.transform.scale ?? [1, 1, 1]} onClick={onClick}>
      {subject.geometry.type === 'box' && (
        <mesh name={subject.name} {...meshShadowProps}>
          <boxGeometry args={subject.geometry.size as [number, number, number]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}
      {subject.geometry.type === 'sphere' && (
        <mesh name={subject.name} {...meshShadowProps}>
          <sphereGeometry args={[subject.geometry.radius, 24, 24]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}
      {subject.geometry.type === 'plane' && (
        <mesh name={subject.name} {...meshShadowProps}>
          <boxGeometry args={subject.geometry.size as [number, number, number]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}
      {subject.geometry.type === 'mesh' && (
        <Suspense fallback={null}>
          <MeshModel src={subject.geometry.src} animate={subject.geometry.animate} animationClip={subject.geometry.animationClip} bbox={subject.geometry.bbox} />
        </Suspense>
      )}
      {selected && (
        <mesh>
          <boxGeometry args={[1.04, 1.04, 1.04]} />
          <meshBasicMaterial color={ACCENT} wireframe />
        </mesh>
      )}

      {children}
    </group>
  );
}
