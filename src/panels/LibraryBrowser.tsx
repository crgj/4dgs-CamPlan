/**
 * 模型库管理面板（src/panels/LibraryBrowser.tsx）。
 *
 * 分两个标签：静态模型（subject 资产）与组合（composite 资产）。
 * 从 IndexedDB 加载（listAssets），支持搜索、删除；卡片可拖入视口实例化。
 * 顶部「保存当前选中为资产」按钮 → 简易命名 → saveAsset。
 *
 * 接入 Dockview（见 DockLayout.tsx 注册 library panel）。
 */
import { useEffect, useState, useCallback } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import {
  listAssets,
  saveAsset,
  deleteAsset,
  type LibraryAsset,
} from '@/lib/libraryAsset';
import { buildAssetFromSelection } from '@/io/libraryAssetBuilder';
import { seedLibraryIfEmpty } from '@/lib/libraryPresets';
import { renderUsdzThumbnail } from '@/lib/thumbnailRenderer';
import { IconFrame, PanelIcon } from './panelIcons';
import { setIconDragImage } from './panelIconUtils';

// 三大类：人物（Human）/ 物体（Object）/ 组合（Composite，摄像机组等）
type Tab = '人物' | '物体' | '组合';

export function LibraryBrowser() {
  const { locale } = useTranslation();
  const scene = usePlanner((s) => s.scene);
  const selection = usePlanner((s) => s.selection);
  const log = usePlanner((s) => s.log);

  const [tab, setTab] = useState<Tab>('人物');
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  // 缩略图渲染状态：src → dataURL（运行时 USDZ 渲染，按需生成）
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listAssets();
      setAssets(all);
    } catch (e) {
      log('error', `${locale === 'zh' ? '加载库失败' : 'Library load failed'}: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [log, locale]);

  // 首次加载：若库为空则写入内置预设，再加载（直接内联异步，避免 effect 内 setState 触发 lint）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seeded = await seedLibraryIfEmpty();
        if (seeded > 0) log('info', `${locale === 'zh' ? '已载入' : 'Seeded'} ${seeded} ${locale === 'zh' ? '个内置预设' : 'built-in presets'}`);
        const all = await listAssets();
        if (!cancelled) {
          setAssets(all);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) setLoading(false);
        log('error', `${locale === 'zh' ? '加载库失败' : 'Library load failed'}: ${e}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [log, locale]);

  // 当前 tab 对应的资产：人物 = category 含「人物」；组合 = kind=composite；物体 = 其余
  const visible = assets
    .filter((a) => {
      if (tab === '人物') return a.category.includes('人物') && a.kind !== 'composite';
      if (tab === '组合') return a.kind === 'composite';
      return a.category.includes('人物') === false && a.kind !== 'composite';
    })
    .filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  // 缩略图生成：assets 加载后，为每个 USDZ 资产（缺 thumbnail）串行渲染缩略图。
  // 用已有的 LibraryAsset.thumbnail 字段；缺则用 renderUsdzThumbnail 运行时生成。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const a of assets) {
        if (cancelled) break;
        // 已有缩略图（持久化的）或已渲染过 → 跳过
        if (a.thumbnail || thumbs[a.id]) continue;
        const def = a.payload.type === 'subject' ? a.payload.def : null;
        const src = def?.geometry?.type === 'mesh' ? def.geometry.src : null;
        if (!src) continue;
        const url = await renderUsdzThumbnail(src);
        if (cancelled) break;
        if (url) setThumbs((t) => ({ ...t, [a.id]: url }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assets, thumbs]);

  const zh = locale === 'zh';

  const handleSaveSelection = async () => {
    if (selection.length === 0) {
      log('warn', zh ? '请先选中要保存的对象' : 'Select objects to save first');
      return;
    }
    const name = window.prompt(zh ? '资产名称：' : 'Asset name:', zh ? '新资产' : 'New Asset');
    if (!name) return;
    const category = window.prompt(zh ? '分类：' : 'Category:', 'general') || 'general';
    try {
      // 组合原点 = 选中实体 AABB 中心（粗略）
      const origin: [number, number, number] = [0, 0, 0];
      const input = buildAssetFromSelection(scene, selection, { name, category, origin });
      await saveAsset(input);
      log('info', `${zh ? '已保存到库' : 'Saved to library'}: ${name}`);
      refresh();
    } catch (e) {
      log('error', `${zh ? '保存失败' : 'Save failed'}: ${e}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(zh ? `删除「${name}」？` : `Delete "${name}"?`)) return;
    try {
      await deleteAsset(id);
      log('info', `${zh ? '已删除' : 'Deleted'}: ${name}`);
      refresh();
    } catch (e) {
      log('error', `${zh ? '删除失败' : 'Delete failed'}: ${e}`);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-panel)] text-[var(--color-text)]">
      {/* 标题 + 保存按钮 */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-header)] px-3">
        <span className="text-[11px] font-bold uppercase tracking-wide">{zh ? '模型库' : 'Library'}</span>
        <button
          type="button"
          onClick={handleSaveSelection}
          disabled={selection.length === 0}
          className="rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-2 py-0.5 text-[10px] text-white disabled:opacity-40"
          title={zh ? '保存当前选中为资产' : 'Save selection as asset'}
        >
          {zh ? '保存选中' : 'Save Sel.'}
        </button>
      </div>

      {/* 标签：人物 / 物体 / 组合 */}
      <div className="flex shrink-0 border-b border-[var(--color-panel-border)]">
        {(['人物', '物体', '组合'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[11px] ${
              tab === t
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-text)]'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            }`}
          >
            {t === '人物' ? (zh ? '人物 Human' : 'Human') : t === '物体' ? (zh ? '物体 Object' : 'Object') : zh ? '组合 Composite' : 'Composite'}
          </button>
        ))}
      </div>

      {/* 搜索 */}
      <div className="shrink-0 border-b border-[var(--color-panel-border)] p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={zh ? '搜索...' : 'Search...'}
          className="h-6 w-full rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-2 text-[11px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {/* 资产列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--color-text-faint)]">{zh ? '加载中...' : 'Loading...'}</div>
        ) : visible.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--color-text-faint)]">
            {zh ? '暂无资产。选中对象后点「保存选中」创建。' : 'No assets. Select objects and "Save Sel." to create.'}
          </div>
        ) : (
          visible.map((a) => (
            <div
              key={a.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-planner-asset', a.id);
                e.dataTransfer.effectAllowed = 'copy';
                setIconDragImage(e.dataTransfer, a.kind === 'composite' ? 'composite' : 'subject');
              }}
              className="group mb-1 flex items-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-transparent px-2 py-1.5 hover:border-[var(--color-panel-border)] hover:bg-[var(--color-panel-raised)] cursor-grab"
              title={zh ? '拖到视口实例化' : 'Drag into viewport to instantiate'}
            >
              <IconFrame>
                {thumbs[a.id] ? (
                  <img
                    src={thumbs[a.id]}
                    alt={a.name}
                    className="h-full w-full rounded-[var(--radius-sm)] object-cover"
                    draggable={false}
                  />
                ) : (
                  <PanelIcon kind={a.kind === 'composite' ? 'composite' : 'subject'} />
                )}
              </IconFrame>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium">{a.name}</span>
                <span className="block truncate text-[10px] text-[var(--color-text-faint)]">
                  {a.category} · {new Date(a.updatedAt).toLocaleDateString()}
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(a.id, a.name);
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-faint)] opacity-0 hover:text-[#e05050] group-hover:opacity-100"
                title={zh ? '删除' : 'Delete'}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
