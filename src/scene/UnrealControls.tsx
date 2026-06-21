// WDD -gemini 2026-06-19 新增符合 Unreal Engine 5 交互规范的视口相机控制组件，支持右键旋转、WASD/QE 飞行漫游及滚轮微调/减慢速度
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlanner } from '@/state/store';

export function UnrealControls() {
  const { camera, gl } = useThree();
  const cameraSpeed = usePlanner((st) => st.view.cameraSpeed);
  const viewportCommand = usePlanner((st) => st.view.viewportCommand);
  const isTransforming = usePlanner((st) => st.view.isTransforming);
  const setCameraSpeed = usePlanner((st) => st.setCameraSpeed);
  const setIsCameraNavigating = usePlanner((st) => st.setIsCameraNavigating);

  // 使用 ref 来保存控制状态，避免触发 React 重绘，保证 60fps 极限流畅度
  const state = useRef({
    isRMB: false,
    isMMB: false,
    speed: 3.0,       // 当前相机飞行移动速度 (m/s)
    lookSpeed: 0.002, // 视角旋转灵敏度
    // WDD -gemini 2026-06-19 添加 shift 键到控制状态
    keys: {
      w: false,
      a: false,
      s: false,
      d: false,
      q: false,
      e: false,
      shift: false,
    },
    euler: new THREE.Euler(0, 0, 0, 'YXZ'),
  });

  // WDD -gemini 2026-06-19 同步 store 的速度到本地控制状态 ref 中
  useEffect(() => {
    state.current.speed = cameraSpeed;
  }, [cameraSpeed]);

  // #WDD-gpt  2026-06-19 - 消费 store 视口命令，实现 F 聚焦与 Home 复位
  useEffect(() => {
    if (!viewportCommand) return;

    const lookAt = (target: THREE.Vector3) => {
      camera.lookAt(target);
      state.current.euler.setFromQuaternion(camera.quaternion);
    };

    if (viewportCommand.kind === 'reset') {
      const target = new THREE.Vector3(0, 0, 0);
      camera.position.set(6, 5, 8);
      lookAt(target);
      return;
    }

    const target = new THREE.Vector3(
      viewportCommand.target[0],
      viewportCommand.target[1],
      viewportCommand.target[2],
    );
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    if (forward.lengthSq() < 1e-6) {
      forward.set(-0.55, -0.45, -0.7).normalize();
    }
    camera.position.copy(target).addScaledVector(forward, -viewportCommand.distance);
    lookAt(target);
  }, [camera, viewportCommand]);

  useEffect(() => {
    const dom = gl.domElement;
    
    // 同步相机当前初始角度
    state.current.euler.setFromQuaternion(camera.quaternion);

    const handleMouseDown = (e: MouseEvent) => {
      if (isTransforming) return;
      // 右键 (RMB) 开始漫游
      if (e.button === 2) {
        state.current.isRMB = true;
        // #WDD-gpt  2026-06-20 - RMB 飞行导航期间全局编辑快捷键暂停，键盘只控制相机
        setIsCameraNavigating(true);
        e.preventDefault();
      }
      // 中键 (MMB) 开始平移
      else if (e.button === 1) {
        state.current.isMMB = true;
        e.preventDefault();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        state.current.isRMB = false;
        setIsCameraNavigating(false);
      } else if (e.button === 1) {
        state.current.isMMB = false;
      }
    };

    const handleBlur = () => {
      state.current.isRMB = false;
      state.current.isMMB = false;
      state.current.keys.w = false;
      state.current.keys.a = false;
      state.current.keys.s = false;
      state.current.keys.d = false;
      state.current.keys.q = false;
      state.current.keys.e = false;
      state.current.keys.shift = false;
      setIsCameraNavigating(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isTransforming) return;
      if (state.current.isRMB) {
        // Look Around: 右键按住拖拽旋转相机
        const { euler, lookSpeed } = state.current;
        euler.y -= e.movementX * lookSpeed;
        euler.x -= e.movementY * lookSpeed;

        // 俯仰角限制：防翻转
        const maxPitch = (85 * Math.PI) / 180;
        euler.x = Math.max(-maxPitch, Math.min(maxPitch, euler.x));

        camera.quaternion.setFromEuler(euler);
      } else if (state.current.isMMB) {
        // Pan: 中键按住拖拽平移相机
        const panSpeed = 0.003 * state.current.speed;
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

        camera.position.addScaledVector(right, -e.movementX * panSpeed);
        camera.position.addScaledVector(up, e.movementY * panSpeed);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (isTransforming) return;
      if (state.current.isRMB) {
        // 🌟 按住右键滚动滚轮：微调漫游速度。向下滚动会减慢速度，向上滚动会加快速度
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        const nextSpeed = Math.max(0.1, Math.min(30.0, state.current.speed * factor));
        setCameraSpeed(nextSpeed);
      } else {
        // 普通滚动：沿视线前进/后退 (类似于 Zoom)
        const zoomSpeed = 0.6 * Math.max(0.5, state.current.speed * 0.3);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const direction = e.deltaY < 0 ? 1 : -1;
        camera.position.addScaledVector(forward, direction * zoomSpeed);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransforming) return;
      const k = e.key.toLowerCase();
      if (k === 'w') state.current.keys.w = true;
      if (k === 'a') state.current.keys.a = true;
      if (k === 's') state.current.keys.s = true;
      if (k === 'd') state.current.keys.d = true;
      if (k === 'q') state.current.keys.q = true;
      if (k === 'e') state.current.keys.e = true;
      if (e.key === 'Shift' || e.key === 'ShiftLeft' || e.key === 'ShiftRight') state.current.keys.shift = true;

      // T-026 Camera Bookmarks：Alt+1..9 保存，Shift+1..9 跳转
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        if (e.altKey) {
          // 保存当前相机位姿（position + lookAt target）
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          const target = camera.position.clone().addScaledVector(forward, 5);
          usePlanner.getState().setBookmark(num - 1, {
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [target.x, target.y, target.z],
          });
          e.preventDefault();
        } else if (e.shiftKey) {
          const bm = usePlanner.getState().bookmarks[num - 1];
          if (bm) {
            camera.position.set(bm.position[0], bm.position[1], bm.position[2]);
            camera.lookAt(bm.target[0], bm.target[1], bm.target[2]);
            state.current.euler.setFromQuaternion(camera.quaternion);
            e.preventDefault();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w') state.current.keys.w = false;
      if (k === 'a') state.current.keys.a = false;
      if (k === 's') state.current.keys.s = false;
      if (k === 'd') state.current.keys.d = false;
      if (k === 'q') state.current.keys.q = false;
      if (k === 'e') state.current.keys.e = false;
      if (e.key === 'Shift' || e.key === 'ShiftLeft' || e.key === 'ShiftRight') state.current.keys.shift = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    dom.addEventListener('contextmenu', handleContextMenu);

    return () => {
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      dom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      dom.removeEventListener('contextmenu', handleContextMenu);
      setIsCameraNavigating(false);
    };
  }, [camera, gl, isTransforming, setCameraSpeed, setIsCameraNavigating]);

  // 帧循环处理飞行移动
  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    const { isRMB, speed, keys } = state.current;
    if (isTransforming) return;

    // WDD -gemini 2026-06-19 添加 Shift 键加速功能，按下时速度提升 2 倍
    const shift = state.current.keys.shift;
    const effectiveSpeed = shift ? speed * 2 : speed;
    if (isRMB) {
      const move = new THREE.Vector3();
      if (keys.w) move.z -= 1;
      if (keys.s) move.z += 1;
      if (keys.a) move.x -= 1;
      if (keys.d) move.x += 1;

      move.normalize();
      move.applyQuaternion(camera.quaternion);

      // Q 降，E 升 (沿世界 Y 轴)
      if (keys.e) move.y += 1;
      if (keys.q) move.y -= 1;

      camera.position.addScaledVector(move, effectiveSpeed * dt);
    }
  });

  return null;
}
