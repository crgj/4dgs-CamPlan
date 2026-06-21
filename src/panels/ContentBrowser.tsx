import { useMemo, useState } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import type { LightDef } from '@/types';
import { IconFrame, PanelIcon } from './panelIcons';
import { iconKindForLight, setIconDragImage, type PanelIconKind } from './panelIconUtils';

type ActorPrototype =
  | {
      id: string;
      category: 'cameras';
      kind: 'camera';
      labelZh: string;
      labelEn: string;
      descriptionZh: string;
      descriptionEn: string;
    }
  | {
      id: string;
      category: 'lights';
      kind: 'light';
      lightKind: LightDef['lightKind'];
      labelZh: string;
      labelEn: string;
      descriptionZh: string;
      descriptionEn: string;
    }
  | {
      id: string;
      category: 'subjects' | 'presets';
      kind: 'subject';
      labelZh: string;
      labelEn: string;
      descriptionZh: string;
      descriptionEn: string;
    };

const ACTORS: ActorPrototype[] = [
  {
    id: 'camera-pinhole',
    category: 'cameras',
    kind: 'camera',
    labelZh: '针孔相机',
    labelEn: 'Pinhole Camera',
    descriptionZh: '标准 4DGS 采集机位',
    descriptionEn: 'Standard capture camera',
  },
  {
    id: 'light-point',
    category: 'lights',
    kind: 'light',
    lightKind: 'point',
    labelZh: '点光源',
    labelEn: 'Point Light',
    descriptionZh: '全向补光',
    descriptionEn: 'Omnidirectional light',
  },
  {
    id: 'light-spot',
    category: 'lights',
    kind: 'light',
    lightKind: 'spot',
    labelZh: '聚光灯',
    labelEn: 'Spot Light',
    descriptionZh: '锥形方向光',
    descriptionEn: 'Cone-shaped directional light',
  },
  {
    id: 'light-directional',
    category: 'lights',
    kind: 'light',
    lightKind: 'directional',
    labelZh: '平行光',
    labelEn: 'Directional Light',
    descriptionZh: '太阳/环境方向光',
    descriptionEn: 'Sun-style directional light',
  },
  {
    id: 'subject-box',
    category: 'subjects',
    kind: 'subject',
    labelZh: '盒状主体',
    labelEn: 'Box Subject',
    descriptionZh: '默认 1m 采样主体',
    descriptionEn: 'Default 1m capture subject',
  },
  {
    id: 'calibration-target',
    category: 'presets',
    kind: 'subject',
    labelZh: '标定靶占位',
    labelEn: 'Calibration Target',
    descriptionZh: '用于后续标定流程的占位主体',
    descriptionEn: 'Placeholder subject for calibration flow',
  },
];

const categoryLabels = {
  cameras: { zh: '摄像机', en: 'Cameras' },
  lights: { zh: '灯光', en: 'Lights' },
  subjects: { zh: '主体', en: 'Subjects' },
  presets: { zh: '预设', en: 'Presets' },
} as const;

function iconKindFor(actor: ActorPrototype): PanelIconKind {
  if (actor.kind === 'camera') return 'camera';
  if (actor.kind === 'light') return iconKindForLight(actor.lightKind);
  return actor.category === 'presets' ? 'calibration' : 'subject';
}

function dragPayload(actor: ActorPrototype) {
  if (actor.kind === 'light') {
    return { kind: actor.kind, lightKind: actor.lightKind };
  }
  return { kind: actor.kind };
}

// #WDD-gpt  2026-06-19 - 新增 UE 风 Content Browser / Place Actors 面板，提供分类、搜索、点击与拖拽创建入口
export function ContentBrowser() {
  const { locale } = useTranslation();
  const addCamera = usePlanner((s) => s.addCamera);
  const addLight = usePlanner((s) => s.addLight);
  const addSubject = usePlanner((s) => s.addSubject);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ActorPrototype['category'] | 'all'>('all');

  const visibleActors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ACTORS.filter((actor) => {
      const label = locale === 'zh' ? actor.labelZh : actor.labelEn;
      const description = locale === 'zh' ? actor.descriptionZh : actor.descriptionEn;
      const matchesCategory = activeCategory === 'all' || actor.category === activeCategory;
      const matchesQuery =
        normalized.length === 0 ||
        label.toLowerCase().includes(normalized) ||
        description.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, locale, query]);

  const createActor = (actor: ActorPrototype) => {
    if (actor.kind === 'camera') addCamera();
    else if (actor.kind === 'light') addLight(actor.lightKind);
    else addSubject();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-panel)] text-[var(--color-text)]">
      <div className="border-b border-[var(--color-panel-border)] p-2">
        <div className="mb-2 flex h-7 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-2">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-faint)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-[11px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
            placeholder={locale === 'zh' ? '搜索可放置对象...' : 'Search placeable actors...'}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`h-6 rounded-[var(--radius-sm)] border px-2 text-[10px] ${
              activeCategory === 'all'
                ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]'
                : 'border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] text-[var(--color-text-dim)]'
            }`}
          >
            {locale === 'zh' ? '全部' : 'All'}
          </button>
          {Object.entries(categoryLabels).map(([key, labels]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key as ActorPrototype['category'])}
              className={`h-6 rounded-[var(--radius-sm)] border px-2 text-[10px] ${
                activeCategory === key
                  ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]'
                  : 'border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
              }`}
            >
              {locale === 'zh' ? labels.zh : labels.en}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {visibleActors.map((actor) => {
          const label = locale === 'zh' ? actor.labelZh : actor.labelEn;
          const description = locale === 'zh' ? actor.descriptionZh : actor.descriptionEn;
          const category = categoryLabels[actor.category];
          return (
            <button
              key={actor.id}
              type="button"
              draggable
              onClick={() => createActor(actor)}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-planner-prototype', JSON.stringify(dragPayload(actor)));
                e.dataTransfer.effectAllowed = 'copy';
                setIconDragImage(e.dataTransfer, iconKindFor(actor));
              }}
              className="group mb-1 flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-transparent bg-transparent px-2 py-1.5 text-left hover:border-[var(--color-panel-border)] hover:bg-[var(--color-panel-raised)]"
              title={description}
            >
              <IconFrame>
                <PanelIcon kind={iconKindFor(actor)} />
              </IconFrame>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-[var(--color-text)]">{label}</span>
                <span className="block truncate text-[10px] text-[var(--color-text-faint)]">{description}</span>
              </span>
              <span className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-recessed)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--color-text-faint)]">
                {locale === 'zh' ? category.zh : category.en}
              </span>
            </button>
          );
        })}
        {visibleActors.length === 0 && (
          <div className="px-3 py-8 text-center text-[11px] text-[var(--color-text-faint)]">
            {locale === 'zh' ? '没有匹配的可放置对象' : 'No placeable actors match the filter'}
          </div>
        )}
      </div>
    </div>
  );
}
