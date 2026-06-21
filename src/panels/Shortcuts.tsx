import { useEffect, useMemo, useState } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import { getShortcutRows, type ShortcutRow } from './shortcutRows';

export function Shortcuts() {
  const { locale } = useTranslation();
  const setActiveOverlay = usePlanner((s) => s.setActiveOverlay);
  const scene = usePlanner((s) => s.scene);
  const selection = usePlanner((s) => s.selection);
  const editingGroupId = usePlanner((s) => s.editingGroupId);

  const allRows = getShortcutRows({ locale, scene, selection, editingGroupId });

  const [group, setGroup] = useState<'all' | ShortcutRow['group']>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveOverlay(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveOverlay]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter((r) => (group === 'all' ? true : r.group === group) && (!q || r.key.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)));
  }, [allRows, group, query]);

  const copyVisible = async () => {
    const text = rows.map((r) => `${r.key} — ${r.desc}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback: create temporary textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  };

  const printList = () => window.print();

  const groups: Array<{ id: 'all' | ShortcutRow['group']; label: string }> = [
    { id: 'all', label: locale === 'zh' ? '全部' : 'All' },
    { id: 'view', label: locale === 'zh' ? '视图' : 'View' },
    { id: 'selection', label: locale === 'zh' ? '选中' : 'Selection' },
    { id: 'edit', label: locale === 'zh' ? '编辑' : 'Edit' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setActiveOverlay(null)}>
      <div className="w-[520px] max-h-[80vh] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-panel-border)] bg-[var(--color-panel)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-10 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-header)] px-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-bold uppercase tracking-wide text-[var(--color-text)]">
              {locale === 'zh' ? '快捷按键' : 'Keyboard Shortcuts'}
            </span>
            <span className="text-[11px] text-[var(--color-text-dim)]">{locale === 'zh' ? '（可根据当前选中动态变化）' : '(context aware)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copyVisible} title={locale === 'zh' ? '复制可见列表' : 'Copy visible'} className="rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-2 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-panel-raised)]">{locale === 'zh' ? '复制' : 'Copy'}</button>
            <button type="button" onClick={printList} title={locale === 'zh' ? '打印' : 'Print'} className="rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-2 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-panel-raised)]">{locale === 'zh' ? '打印' : 'Print'}</button>
            <button type="button" onClick={() => setActiveOverlay(null)} className="text-[14px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">✕</button>
          </div>
        </div>

        <div className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {groups.map((g) => (
                <button key={g.id} type="button" onClick={() => setGroup(g.id)} className={`rounded-[var(--radius-sm)] px-2 py-1 text-[11px] ${group === g.id ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]' : 'border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="ml-auto w-48">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={locale === 'zh' ? '搜索快捷键或描述' : 'Search key or description'} className="w-full h-7 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] px-2 text-[12px] text-[var(--color-text)] focus:outline-none" />
            </div>
          </div>

          <p className="mt-3 mb-2 text-[12px] text-[var(--color-text-dim)]">{locale === 'zh' ? '下列会根据当前选中内容显示可用快捷按键：' : 'Available shortcuts update with the current selection:'}</p>

          <div className="max-h-[52vh] overflow-y-auto pr-2">
            <div className="flex flex-col gap-2">
              {rows.length === 0 ? (
                <div className="p-3 text-[12px] text-[var(--color-text-dim)]">{locale === 'zh' ? '没有可用的快捷键' : 'No shortcuts available'}</div>
              ) : (
                rows.map((r, idx) => (
                  <div key={`${r.key}-${idx}`} className="flex items-center gap-3 rounded-sm px-2 py-1 hover:bg-[var(--color-recessed)]">
                    <div className="w-36 shrink-0 text-[12px] font-mono text-[var(--color-text)]">
                      <span className="inline-flex gap-1">
                        {r.key.split(' ').map((k, i) => (
                          <span key={i} className="inline-block rounded-[4px] border px-2 py-0.5 text-[11px] bg-[var(--color-panel-raised)]">{k}</span>
                        ))}
                      </span>
                    </div>
                    <div className="text-[12px] text-[var(--color-text-dim)]">{r.desc}</div>
                    <div className="ml-auto text-[10px] text-[var(--color-text-faint)] px-1">{r.group}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-panel-border)] px-3 py-2">
          <button type="button" onClick={() => setActiveOverlay(null)} className="rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-4 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-panel-raised)]">
            {locale === 'zh' ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
