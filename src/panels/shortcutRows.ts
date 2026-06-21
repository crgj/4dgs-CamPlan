import type { AnyEntity, EntityId, SceneDef } from '@/types';

export interface ShortcutRow {
  key: string;
  desc: string;
  group: 'selection' | 'view' | 'edit';
}

type Locale = 'zh' | 'en';

function entityById(scene: SceneDef, id: EntityId): AnyEntity | undefined {
  return (
    scene.cameras.find((entity) => entity.id === id) ??
    scene.lights.find((entity) => entity.id === id) ??
    scene.subjects.find((entity) => entity.id === id) ??
    scene.groups?.find((entity) => entity.id === id)
  );
}

function label(locale: Locale, zh: string, en: string) {
  return locale === 'zh' ? zh : en;
}

// #WDD-gpt  2026-06-21 - 根据当前选择上下文生成可用快捷键，供弹窗与视口 HUD 共用
export function getShortcutRows({
  locale,
  scene,
  selection,
  editingGroupId,
  compact = false,
}: {
  locale: Locale;
  scene: SceneDef;
  selection: EntityId[];
  editingGroupId: EntityId | null;
  compact?: boolean;
}): ShortcutRow[] {
  const selectedEntities = selection.map((id) => entityById(scene, id)).filter((entity): entity is AnyEntity => Boolean(entity));
  const activeEntity = selectedEntities.at(-1);
  const isCamera = activeEntity?.kind === 'camera';
  const hasSelection = selectedEntities.length > 0;
  const isMulti = selectedEntities.length > 1;

  const rows: ShortcutRow[] = [
    {
      key: '1 / 2 / 3 / 4',
      desc: label(locale, '切换视图', 'Switch view'),
      group: 'view',
    },
    {
      key: 'Spc',
      desc: label(locale, '覆盖热图', 'Heatmap'),
      group: 'view',
    },
    {
      key: 'G',
      desc: label(locale, '切换捕捉', 'Toggle snap'),
      group: 'edit',
    },
    {
      key: '^Z / ^Y',
      desc: label(locale, '撤销重做', 'Undo redo'),
      group: 'edit',
    },
    {
      key: '^V',
      desc: label(locale, '粘贴', 'Paste'),
      group: 'edit',
    },
  ];

  if (editingGroupId) {
    rows.unshift({
      key: 'Esc',
      desc: label(locale, '退出组', 'Exit group'),
      group: 'edit',
    });
  }

  if (hasSelection) {
    rows.unshift(
      {
        key: 'W/E/R',
        desc: isMulti ? label(locale, '多选变换', 'Multi xform') : label(locale, '变换模式', 'Xform mode'),
        group: 'selection',
      },
      {
        key: 'F',
        desc: isCamera ? label(locale, '相机视点', 'Cam view') : label(locale, '聚焦', 'Focus'),
        group: 'selection',
      },
      {
        key: '^C',
        desc: label(locale, '复制', 'Copy'),
        group: 'selection',
      },
      {
        key: '^D',
        desc: label(locale, '原地复制', 'Duplicate'),
        group: 'selection',
      },
      {
        key: 'Del',
        desc: label(locale, '删除', 'Delete'),
        group: 'selection',
      },
    );
  }

  if (isCamera) {
    rows.unshift({
      key: 'C',
      desc: label(locale, '设为视点', 'Set view'),
      group: 'selection',
    });
  }

  return compact ? rows.slice(0, hasSelection ? 8 : 6) : rows;
}
