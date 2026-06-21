/**
 * T-035 Autosave hook（src/io/useAutosave.ts）。
 * 定时把当前场景写入 localStorage（best effort）。
 * 成功手动保存/加载时清掉 autosave。启动时若存在 autosave 且与当前不同，提示恢复。
 */
import { useEffect } from 'react';
import { usePlanner } from '@/state/store';
import { writeAutosave, clearAutosave } from './sceneFiles';

const AUTOSAVE_INTERVAL_MS = 30_000;

/** 定时自动保存脏场景。 */
export function useAutosave(): void {
  const dirty = usePlanner((s) => s.dirty);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const st = usePlanner.getState();
      if (!st.dirty) return;
      const ok = writeAutosave(st.scene);
      if (ok) {
        st.log('info', usePlanner.getState().locale === 'zh' ? '场景已自动保存（草稿）' : 'Scene auto-saved (draft)');
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dirty]);
}

/** 手动保存/加载成功后调用：清掉 autosave 草稿。 */
export function clearAutosaveOnCommit(): void {
  clearAutosave();
}
