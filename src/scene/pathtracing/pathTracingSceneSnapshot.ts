import * as THREE from 'three';

function asColor(value: unknown, fallback: THREE.Color): THREE.Color {
  return value instanceof THREE.Color ? value : fallback;
}

function asTexture(value: unknown): THREE.Texture | null {
  return value instanceof THREE.Texture ? value : null;
}

function isMaterial(value: unknown): value is THREE.Material {
  return Boolean(value && typeof value === 'object' && (value as THREE.Material).isMaterial);
}

function toPathTracingMaterial(material: unknown): THREE.MeshStandardMaterial {
  const baseMaterial = isMaterial(material) ? material : new THREE.MeshBasicMaterial({ color: 0xffffff });
  const source = baseMaterial as THREE.Material & {
    color?: unknown;
    emissive?: unknown;
    map?: unknown;
    normalMap?: unknown;
    roughnessMap?: unknown;
    metalnessMap?: unknown;
    roughness?: unknown;
    metalness?: unknown;
    emissiveIntensity?: unknown;
    opacity?: unknown;
    alphaTest?: unknown;
  };
  const converted = new THREE.MeshStandardMaterial({
    color: asColor(source.color, new THREE.Color(0xffffff)),
    emissive: asColor(source.emissive, new THREE.Color(0x000000)),
    emissiveIntensity: typeof source.emissiveIntensity === 'number' ? source.emissiveIntensity : 0,
    map: asTexture(source.map),
    normalMap: asTexture(source.normalMap),
    roughnessMap: asTexture(source.roughnessMap),
    metalnessMap: asTexture(source.metalnessMap),
    roughness: typeof source.roughness === 'number' ? source.roughness : 0.85,
    metalness: typeof source.metalness === 'number' ? source.metalness : 0,
    opacity: typeof source.opacity === 'number' ? source.opacity : baseMaterial.opacity,
    alphaTest: typeof source.alphaTest === 'number' ? source.alphaTest : baseMaterial.alphaTest,
    transparent: baseMaterial.transparent,
    side: baseMaterial.side,
  });
  converted.name = baseMaterial.name ? `${baseMaterial.name} PT` : 'PT compatible material';
  return converted;
}

function copyLightForSnapshot(light: THREE.Light): THREE.Light {
  const cloned = light.clone(false);
  cloned.matrixAutoUpdate = false;
  cloned.matrix.copy(light.matrixWorld);
  cloned.matrix.decompose(cloned.position, cloned.quaternion, cloned.scale);
  cloned.updateMatrixWorld(true);
  return cloned;
}

export function createPathTracingSceneSnapshot(sourceScene: THREE.Scene): THREE.Scene {
  sourceScene.updateMatrixWorld(true);
  const snapshot = new THREE.Scene();
  snapshot.background = sourceScene.background;
  snapshot.environment = sourceScene.environment;

  sourceScene.traverse((object) => {
    if (object === sourceScene || !object.visible) return;

    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry instanceof THREE.BufferGeometry) {
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      // #WDD-gpt  2026-06-21 - PT 快照只重建纯 Mesh + 标准材质场景，避免 Line/Text/Gizmo 或异常 USDZ 材质进入 path tracer 后崩溃
      const convertedMaterials = sourceMaterials.map((material) => toPathTracingMaterial(material));
      const snapshotMesh = new THREE.Mesh(
        mesh.geometry,
        Array.isArray(mesh.material) ? convertedMaterials : convertedMaterials[0],
      );
      snapshotMesh.name = mesh.name;
      snapshotMesh.matrixAutoUpdate = false;
      snapshotMesh.matrix.copy(mesh.matrixWorld);
      snapshotMesh.matrix.decompose(snapshotMesh.position, snapshotMesh.quaternion, snapshotMesh.scale);
      snapshotMesh.castShadow = true;
      snapshotMesh.receiveShadow = true;
      snapshot.add(snapshotMesh);
      return;
    }

    const light = object as THREE.Light;
    if (light.isLight) {
      snapshot.add(copyLightForSnapshot(light));
    }
  });

  return snapshot;
}

export function disposePathTracingSceneSnapshot(snapshot: THREE.Scene): void {
  snapshot.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  });
}
