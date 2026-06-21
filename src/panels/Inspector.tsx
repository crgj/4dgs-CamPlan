// WDD -gemini 2026-06-19 属性细节面板重构，全面对接 i18n 翻译，增补 UE5.8 高细节 SVG 图标

import React, { useState } from 'react';
import { usePlanner } from '@/state/store';
import { NumberInput } from '@/ui/NumberInput';
import { useTranslation } from '@/lib/i18n';
import type { AnyEntity, CameraDef, LightDef, SubjectDef, GroupDef, EnvDef, Transform } from '@/types';
import { CameraPreview } from '@/scene/CameraPreview';

// ==================== UE5 风高细节 SVG 图标集 ====================
const IconTransform = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M12 2L8 6h3v5H6V8L2 12l4 4v-3h5v5H8l4 4 4-4h-3v-5h5v3l4-4-4-4v3h-5V6h3L12 2z"/>
  </svg>
);

const IconCamera = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM10 15c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
  </svg>
);

const IconExposure = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5L12 7zm0 2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0-8l1.7 3.4 3.7.6-2.7 2.6.6 3.7-3.3-1.7-3.3 1.7.6-3.7-2.7-2.6 3.7-.6L12 1z"/>
  </svg>
);

const IconLight = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-1.3l-.85-.6C7.8 13.1 7 11.14 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.14-.8 4.1-2.15 5.1z"/>
  </svg>
);

const IconSubject = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
  </svg>
);

const IconEnvironment = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

const IconGround = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M2 19h20v2H2v-2zm2-4h16v2H4v-2zm3-4h10v2H7v-2zm2-4h6v2H9V7z"/>
  </svg>
);

const IconMetadata = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  </svg>
);

// 折叠栏 Header 组件
function CategoryHeader({
  title,
  isOpen,
  onToggle,
  icon,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div
      onClick={onToggle}
      className="flex h-7 select-none cursor-pointer items-center justify-between bg-[var(--color-panel-header)] px-2 font-semibold text-[var(--text-label)] border-b border-[var(--color-panel-border)] hover:bg-[var(--color-panel-raised)] transition-colors"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className="text-[var(--color-accent-cyan)] w-3.5 h-3.5 shrink-0 flex items-center justify-center">{icon}</span>}
        <span className="uppercase tracking-wide truncate">{title}</span>
      </div>
      <svg
        className={`w-2.5 h-2.5 fill-[var(--color-text-dim)] transform transition-transform shrink-0 ${
          isOpen ? 'rotate-90' : 'rotate-0'
        }`}
        viewBox="0 0 16 16"
      >
        <path d="m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z" />
      </svg>
    </div>
  );
}

// 属性行 Container 组件
function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center min-h-[var(--row-h)] px-2 py-0.5 text-[11px] min-w-0">
      <span className="w-20 shrink-0 text-[var(--color-text-dim)] text-[var(--text-label)] truncate" title={label}>
        {label}
      </span>
      <div className="flex-1 flex min-w-0 items-center overflow-hidden">{children}</div>
    </div>
  );
}

export function Inspector() {
  const { t, locale } = useTranslation();
  const {
    selectedEntity,
    updateCamera,
    updateLight,
    updateSubject,
    updateGroup,
    updateTransform,
    updateEnv,
    renameEntity,
    commitHistory,
    scene,
    selection,
  } = usePlanner();

  // T-029：多选——收集全部选中实体，判断是否同类型以支持 Mixed Value 批量编辑。
  const allEntities: AnyEntity[] = [...scene.cameras, ...scene.lights, ...scene.subjects, ...(scene.groups ?? [])];
  const selectedEntities = selection
    .map((id) => allEntities.find((e) => e.id === id) ?? null)
    .filter((e): e is AnyEntity => e !== null);
  const isMultiSelect = selectedEntities.length > 1;
  const multiSelectKind = isMultiSelect && selectedEntities.every((e) => e.kind === selectedEntities[0].kind)
    ? selectedEntities[0].kind
    : null;

  const entity = selectedEntity();

  // T-029：批量 transform 写入所有选中实体（Mixed Value 场景）。
  const updateTransformAll = (tNew: Transform, withHistory?: boolean) => {
    for (const e of selectedEntities) {
      updateTransform(e.id, tNew, withHistory);
    }
  };

  // #WDD-gpt 2026-06-21 - 批量按类型写入：把 patch 应用到所有同类型选中实体。
  const updateCamerasAll = (patch: Partial<CameraDef>, withHistory?: boolean) => {
    for (const e of selectedEntities) if (e.kind === 'camera') updateCamera(e.id, patch, withHistory);
  };
  const updateLightsAll = (patch: Partial<LightDef>, withHistory?: boolean) => {
    for (const e of selectedEntities) if (e.kind === 'light') updateLight(e.id, patch, withHistory);
  };
  const updateSubjectsAll = (patch: Partial<SubjectDef>, withHistory?: boolean) => {
    for (const e of selectedEntities) if (e.kind === 'subject') updateSubject(e.id, patch, withHistory);
  };

  // #WDD-gpt 2026-06-21 - Mixed 值辅助：返回选中实体在某 getter 上是否不一致。
  const mixedOf = <T,>(getter: (e: AnyEntity) => T): boolean =>
    !selectedEntities.every((e) => getter(e) === getter(selectedEntities[0]));
  const firstVal = <T,>(getter: (e: AnyEntity) => T): T => getter(selectedEntities[0]);

  // 多选 Position 批量编辑：值统一时显示实际值，不一致显示 mixed。
  const mixedPosition: [boolean, boolean, boolean] = [
    mixedOf((e) => e.transform.position[0]),
    mixedOf((e) => e.transform.position[1]),
    mixedOf((e) => e.transform.position[2]),
  ];
  const mixedRotation: [boolean, boolean, boolean] = [
    mixedOf((e) => e.transform.rotation[0]),
    mixedOf((e) => e.transform.rotation[1]),
    mixedOf((e) => e.transform.rotation[2]),
  ];
  const hasScale = selectedEntities.every((e) => e.transform.scale);
  const mixedScale: [boolean, boolean, boolean] = hasScale
    ? [
        mixedOf((e) => e.transform.scale![0]),
        mixedOf((e) => e.transform.scale![1]),
        mixedOf((e) => e.transform.scale![2]),
      ]
    : [true, true, true];

  // 多选批量编辑面板
  const renderMultiSelectGroup = () => {
    return (
      <>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] px-3">
          <span className="font-bold text-[var(--color-text)]">
            {selectedEntities.length} {locale === 'zh' ? '个选中对象' : 'Selected'}
          </span>
          <span className="text-[var(--text-label)] font-mono text-[var(--color-text-dim)] uppercase select-none opacity-75">
            {multiSelectKind ?? 'mixed'}
          </span>
        </div>

        {/* 名称（所有类型共享） */}
        <div className="border-b border-[var(--color-panel-border)] px-3 py-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-faint)]">
              {locale === 'zh' ? '名称 (Name)' : 'Name'}
            </span>
            <input
              type="text"
              value={selectedEntities[0].name}
              placeholder={mixedOf((e) => e.name) ? '—' : undefined}
              onChange={(e) => {
                const name = e.target.value;
                updateCamerasAll({ name }, false);
                updateLightsAll({ name }, false);
                updateSubjectsAll({ name }, false);
                // 组合也改名（逐个）
                for (const g of selectedEntities) {
                  if (g.kind === 'group') updateGroup(g.id, { name }, false);
                }
              }}
              onBlur={commitHistory}
              className="h-[var(--control-h)] w-full rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-2 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        {/* 变换（位置/旋转/缩放）—— 所有类型共享 */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={t('transform')}
            icon={IconTransform}
            isOpen={folds.transform}
            onToggle={() => toggleFold('transform')}
          />
          {folds.transform && (
            <div className="flex flex-col gap-1.5 py-2">
              <PropertyRow label={t('location')}>
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {([0, 1, 2] as const).map((axis) => (
                    <NumberInput
                      key={axis}
                      label={['X', 'Y', 'Z'][axis]}
                      axisColorClass={`border-l-2 border-[var(--color-axis-${['x', 'y', 'z'][axis]})]`}
                      mixed={mixedPosition[axis]}
                      value={firstVal((e) => e.transform.position[axis])}
                      onCommitHistory={commitHistory}
                      onChange={(v, hist) => {
                        const base = selectedEntities[0].transform.position;
                        const next: [number, number, number] = [base[0], base[1], base[2]];
                        next[axis] = v;
                        updateTransformAll({ ...selectedEntities[0].transform, position: next }, hist);
                      }}
                      suffix="m"
                    />
                  ))}
                </div>
              </PropertyRow>
              <PropertyRow label={t('rotation')}>
                <div className="flex-1 grid grid-cols-3 gap-1">
                  {([0, 1, 2] as const).map((axis) => (
                    <NumberInput
                      key={axis}
                      label={['X', 'Y', 'Z'][axis]}
                      axisColorClass={`border-l-2 border-[var(--color-axis-${['x', 'y', 'z'][axis]})]`}
                      mixed={mixedRotation[axis]}
                      value={firstVal((e) => e.transform.rotation[axis])}
                      onCommitHistory={commitHistory}
                      onChange={(v, hist) => {
                        const base = selectedEntities[0].transform.rotation;
                        const next: [number, number, number] = [base[0], base[1], base[2]];
                        next[axis] = v;
                        updateTransformAll({ ...selectedEntities[0].transform, rotation: next }, hist);
                      }}
                      suffix="°"
                    />
                  ))}
                </div>
              </PropertyRow>
              {hasScale && (
                <PropertyRow label={t('scale')}>
                  <div className="flex-1 grid grid-cols-3 gap-1">
                    {([0, 1, 2] as const).map((axis) => (
                      <NumberInput
                        key={axis}
                        label={['X', 'Y', 'Z'][axis]}
                        axisColorClass={`border-l-2 border-[var(--color-axis-${['x', 'y', 'z'][axis]})]`}
                        mixed={mixedScale[axis]}
                        value={firstVal((e) => e.transform.scale![axis])}
                        onCommitHistory={commitHistory}
                        onChange={(v, hist) => {
                          const base = selectedEntities[0].transform.scale!;
                          const next: [number, number, number] = [base[0], base[1], base[2]];
                          next[axis] = v;
                          updateTransformAll(
                            { ...selectedEntities[0].transform, scale: next },
                            hist,
                          );
                        }}
                      />
                    ))}
                  </div>
                </PropertyRow>
              )}
              <div className="px-2 py-1 text-[10px] text-[var(--color-text-faint)]">
                {locale === 'zh'
                  ? '数值变更将应用到全部选中对象（混合值显示 “—”）。'
                  : 'Changes apply to all selected (mixed values shown as “—”).'}
              </div>
            </div>
          )}
        </div>

        {/* 启用（所有类型共享） */}
        <div className="border-b border-[var(--color-panel-border)] px-3 py-2">
          <PropertyRow label="Enabled">
            <input
              type="checkbox"
              className="rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] text-[var(--color-accent)] focus:ring-0 focus:outline-none cursor-pointer"
              checked={selectedEntities.every((e) => e.enabled)}
              ref={(el) => {
                if (el) el.indeterminate = mixedOf((e) => e.enabled);
              }}
              onChange={(e) => {
                const enabled = e.target.checked;
                updateCamerasAll({ enabled }, false);
                updateLightsAll({ enabled }, false);
                updateSubjectsAll({ enabled }, false);
                for (const g of selectedEntities.filter((x) => x.kind === 'group')) {
                  updateGroup(g.id, { enabled }, false);
                }
                commitHistory();
              }}
            />
          </PropertyRow>
        </div>

        {/* 类型专属共享属性（仅同类型多选时显示） */}
        {multiSelectKind === 'camera' && renderMultiSelectCamera()}
        {multiSelectKind === 'light' && renderMultiSelectLight()}
        {multiSelectKind === 'subject' && renderMultiSelectSubject()}
      </>
    );
  };

  // 多选相机专属：FOV / Near / Far / 曝光
  const renderMultiSelectCamera = () => (
    <div className="border-b border-[var(--color-panel-border)]">
      <CategoryHeader
        title={t('optical')}
        icon={IconCamera}
        isOpen={folds.camera}
        onToggle={() => toggleFold('camera')}
      />
      {folds.camera && (
        <div className="flex flex-col gap-1.5 py-2">
          <PropertyRow label={t('fov')}>
            <NumberInput
              mixed={mixedOf((e) => (e as CameraDef).fov)}
              value={firstVal((e) => (e as CameraDef).fov)}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => updateCamerasAll({ fov: v }, hist)}
              min={1}
              max={179}
              suffix="°"
              className="flex-1"
            />
          </PropertyRow>
          <PropertyRow label={t('nearClip')}>
            <NumberInput
              mixed={mixedOf((e) => (e as CameraDef).near)}
              value={firstVal((e) => (e as CameraDef).near)}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => updateCamerasAll({ near: v }, hist)}
              min={0.01}
              suffix="m"
              className="flex-1"
            />
          </PropertyRow>
          <PropertyRow label={t('farClip')}>
            <NumberInput
              mixed={mixedOf((e) => (e as CameraDef).far)}
              value={firstVal((e) => (e as CameraDef).far)}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => updateCamerasAll({ far: v }, hist)}
              min={0.1}
              suffix="m"
              className="flex-1"
            />
          </PropertyRow>
          {/* 曝光（ISO/Shutter/Aperture） */}
          <PropertyRow label={locale === 'zh' ? '感光度 (ISO)' : 'ISO'}>
            <NumberInput
              mixed={mixedOf((e) => (e as CameraDef).exposure.iso)}
              value={firstVal((e) => (e as CameraDef).exposure.iso)}
              onCommitHistory={commitHistory}
              onChange={(v, hist) =>
                updateCamerasAll(
                  { exposure: { ...(selectedEntities[0] as CameraDef).exposure, iso: v } as CameraDef['exposure'] },
                  hist,
                )
              }
              min={50}
              className="flex-1"
            />
          </PropertyRow>
          <PropertyRow label={locale === 'zh' ? '光圈 (Aperture)' : 'Aperture'}>
            <NumberInput
              mixed={mixedOf((e) => (e as CameraDef).exposure.aperture)}
              value={firstVal((e) => (e as CameraDef).exposure.aperture)}
              onCommitHistory={commitHistory}
              onChange={(v, hist) =>
                updateCamerasAll(
                  { exposure: { ...(selectedEntities[0] as CameraDef).exposure, aperture: v } as CameraDef['exposure'] },
                  hist,
                )
              }
              min={1}
              className="flex-1"
            />
          </PropertyRow>
        </div>
      )}
    </div>
  );

  // 多选灯光专属：强度 / 颜色
  const renderMultiSelectLight = () => (
    <div className="border-b border-[var(--color-panel-border)]">
      <CategoryHeader
        title={t('optical')}
        icon={IconLight}
        isOpen={folds.light}
        onToggle={() => toggleFold('light')}
      />
      {folds.light && (
        <div className="flex flex-col gap-1.5 py-2">
          <PropertyRow label={locale === 'zh' ? '光照强度' : 'Intensity'}>
            <NumberInput
              mixed={mixedOf((e) => (e as LightDef).intensity)}
              value={firstVal((e) => (e as LightDef).intensity)}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => updateLightsAll({ intensity: v }, hist)}
              min={0}
              className="flex-1"
            />
          </PropertyRow>
          <PropertyRow label={locale === 'zh' ? '颜色 (Color)' : 'Color'}>
            <input
              type="color"
              value={'#' + firstVal((e) => (e as LightDef).color).toString(16).padStart(6, '0')}
              onChange={(e) => updateLightsAll({ color: parseInt(e.target.value.slice(1), 16) }, false)}
              onBlur={commitHistory}
              className="h-[var(--control-h)] w-full rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)] cursor-pointer"
            />
          </PropertyRow>
        </div>
      )}
    </div>
  );

  // 多选主体专属：采样密度
  const renderMultiSelectSubject = () => (
    <div className="border-b border-[var(--color-panel-border)]">
      <CategoryHeader
        title={locale === 'zh' ? '采集' : 'Capture'}
        icon={IconSubject}
        isOpen={folds.subject}
        onToggle={() => toggleFold('subject')}
      />
      {folds.subject && (
        <div className="flex flex-col gap-1.5 py-2">
          <PropertyRow label={locale === 'zh' ? '采样密度' : 'Sample Density'}>
            <NumberInput
              mixed={mixedOf((e) => (e as SubjectDef).sampleDensity)}
              value={firstVal((e) => (e as SubjectDef).sampleDensity)}
              onCommitHistory={commitHistory}
              onChange={(v, hist) => updateSubjectsAll({ sampleDensity: v }, hist)}
              min={1}
              className="flex-1"
            />
          </PropertyRow>
        </div>
      )}
    </div>
  );

  // WDD -gemini 2026-06-19 增加获取可绑定的候选父级实体列表的过滤方法，防成环
  const getCandidateParents = (ent: AnyEntity): AnyEntity[] => {
    const allEntities = [
      ...scene.cameras,
      ...scene.lights,
      ...scene.subjects,
      ...(scene.groups ?? []),
    ];

    const isDescendant = (candidateId: string, ancestorId: string): boolean => {
      let curr = allEntities.find((e) => e.id === candidateId);
      while (curr) {
        if (curr.parentId === ancestorId) return true;
        if (!curr.parentId) break;
        curr = allEntities.find((e) => e.id === curr!.parentId);
      }
      return false;
    };

    return allEntities.filter((e) => {
      if (e.id === ent.id) return false;
      if (isDescendant(e.id, ent.id)) return false;
      return true;
    });
  };

  // WDD -gemini 2026-06-19 提交更改实体的 parentId 变换动作
  const handleParentChange = (entId: string, parentId: string | undefined) => {
    commitHistory();
    const patch = { parentId };
    if (entity && entity.id === entId) {
      if (entity.kind === 'camera') {
        updateCamera(entId, patch);
      } else if (entity.kind === 'light') {
        updateLight(entId, patch);
      } else if (entity.kind === 'subject') {
        updateSubject(entId, patch);
      } else if (entity.kind === 'group') {
        updateGroup(entId, patch);
      }
    }
  };

  // 各组折叠状态
  const [folds, setFolds] = useState<Record<string, boolean>>({
    preview: true,
    transform: true,
    camera: true,
    light: true,
    subject: true,
    exposure: true,
    metadata: true,
    envAmbient: true,
    envGround: true,
    envFog: true,
  });

  const toggleFold = (key: string) => {
    setFolds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ColorHex ↔ '#RRGGBB'
  const hexNumToStr = (num: number) => '#' + num.toString(16).padStart(6, '0');
  const hexStrToNum = (str: string) => parseInt(str.replace('#', ''), 16) || 0;

  // 渲染色块选择器
  const renderColorPicker = (
    value: number,
    onValueChange: (v: number, hist?: boolean) => void
  ) => {
    const hexStr = hexNumToStr(value);
    return (
      <div className="flex flex-1 items-center gap-1.5 h-6">
        <label
          className="w-8 h-4 rounded-sm border border-[var(--color-panel-border)] cursor-pointer shrink-0"
          style={{ backgroundColor: hexStr }}
          title="Pick Color"
        >
          <input
            type="color"
            className="sr-only"
            value={hexStr}
            onChange={(e) => onValueChange(hexStrToNum(e.target.value), false)}
            onBlur={() => onValueChange(value, true)} // 失焦写入历史
          />
        </label>
        <span className="font-mono text-[var(--text-label)] text-[var(--color-text)] shrink-0 select-all">
          {hexStr.toUpperCase()}
        </span>
      </div>
    );
  };

  // 1. 渲染 Transform 调节栏
  const renderTransformGroup = (ent: AnyEntity) => {
    const tData = ent.transform;
    return (
      <div className="border-b border-[var(--color-panel-border)]">
        <CategoryHeader
          title={t('transform')}
          icon={IconTransform}
          isOpen={folds.transform}
          onToggle={() => toggleFold('transform')}
        />
        {folds.transform && (
          <div className="flex flex-col gap-1.5 py-2">
            <PropertyRow label={locale === 'zh' ? '父级' : 'Parent'}>
              <select
                className="flex-1 h-6 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] text-[var(--color-text)] text-[11px] px-1.5 focus:border-[var(--color-accent)] focus:outline-none"
                value={ent.parentId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  handleParentChange(ent.id, val === '' ? undefined : val);
                }}
              >
                <option value="">{locale === 'zh' ? '无 (根节点)' : 'None (Root)'}</option>
                {getCandidateParents(ent).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </PropertyRow>

            <PropertyRow label={t('location')}>
              <div className="flex-1 grid grid-cols-3 gap-1">
                <NumberInput
                  label="X"
                  value={tData.position[0]}
                  axisColorClass="border-l-2 border-[var(--color-axis-x)]"
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => {
                    const next: [number, number, number] = [v, tData.position[1], tData.position[2]];
                    updateTransform(ent.id, { ...tData, position: next }, hist);
                  }}
                  suffix="m"
                />
                <NumberInput
                  label="Y"
                  value={tData.position[1]}
                  axisColorClass="border-l-2 border-[var(--color-axis-y)]"
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => {
                    const next: [number, number, number] = [tData.position[0], v, tData.position[2]];
                    updateTransform(ent.id, { ...tData, position: next }, hist);
                  }}
                  suffix="m"
                />
                <NumberInput
                  label="Z"
                  value={tData.position[2]}
                  axisColorClass="border-l-2 border-[var(--color-axis-z)]"
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => {
                    const next: [number, number, number] = [tData.position[0], tData.position[1], v];
                    updateTransform(ent.id, { ...tData, position: next }, hist);
                  }}
                  suffix="m"
                />
              </div>
            </PropertyRow>

            <PropertyRow label={t('rotation')}>
              <div className="flex-1 grid grid-cols-3 gap-1">
                <NumberInput
                  label="R"
                  value={tData.rotation[0]}
                  axisColorClass="border-l-2 border-[var(--color-axis-x)]"
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => {
                    const next: [number, number, number] = [v, tData.rotation[1], tData.rotation[2]];
                    updateTransform(ent.id, { ...tData, rotation: next }, hist);
                  }}
                  suffix="°"
                />
                <NumberInput
                  label="P"
                  value={tData.rotation[1]}
                  axisColorClass="border-l-2 border-[var(--color-axis-y)]"
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => {
                    const next: [number, number, number] = [tData.rotation[0], v, tData.rotation[2]];
                    updateTransform(ent.id, { ...tData, rotation: next }, hist);
                  }}
                  suffix="°"
                />
                <NumberInput
                  label="Y"
                  value={tData.rotation[2]}
                  axisColorClass="border-l-2 border-[var(--color-axis-z)]"
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => {
                    const next: [number, number, number] = [tData.rotation[0], tData.rotation[1], v];
                    updateTransform(ent.id, { ...tData, rotation: next }, hist);
                  }}
                  suffix="°"
                />
              </div>
            </PropertyRow>
          </div>
        )}
      </div>
    );
  };

  // 2. 渲染主名称/标题行
  const renderIdentityRow = (ent: AnyEntity) => {
    return (
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] px-3 min-w-0">
        <input
          type="text"
          className="h-6 min-w-0 flex-1 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] px-1.5 text-[11px] font-bold text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none truncate"
          value={ent.name}
          onChange={(e) => renameEntity(ent.id, e.target.value)}
        />
        <span className="text-[var(--text-label)] font-mono text-[var(--color-text-dim)] uppercase select-none opacity-75 ml-2 shrink-0">
          {ent.kind}
        </span>
      </div>
    );
  };

  // 3. Camera 具体属性
  const renderCameraGroup = (cam: CameraDef) => {
    return (
      <>
        {renderIdentityRow(cam)}
        {renderTransformGroup(cam)}

        {/* #WDD-gpt 2026-06-21 - 相机实时预览：从该相机位姿/投影看出去的画面，随参数变化实时更新 */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={locale === 'zh' ? '预览' : 'Preview'}
            icon={IconCamera}
            isOpen={folds.preview}
            onToggle={() => toggleFold('preview')}
          />
          {folds.preview && (
            <div className="px-2 py-2">
              <CameraPreview cam={cam} />
            </div>
          )}
        </div>

        {/* Camera Params */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={t('optical')}
            icon={IconCamera}
            isOpen={folds.camera}
            onToggle={() => toggleFold('camera')}
          />
          {folds.camera && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label={t('fov')}>
                <NumberInput
                  value={cam.fov}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateCamera(cam.id, { fov: v }, hist)}
                  min={1}
                  max={179}
                  suffix="°"
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('aspect')}>
                <NumberInput
                  value={cam.aspect}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateCamera(cam.id, { aspect: v }, hist)}
                  min={0.1}
                  max={10}
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('nearClip')}>
                <NumberInput
                  value={cam.near}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateCamera(cam.id, { near: v }, hist)}
                  min={0.01}
                  suffix="m"
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('farClip')}>
                <NumberInput
                  value={cam.far}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateCamera(cam.id, { far: v }, hist)}
                  min={0.1}
                  suffix="m"
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('resolution') + ' (W)'}>
                <NumberInput
                  value={cam.resolution.width}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) =>
                    updateCamera(cam.id, { resolution: { ...cam.resolution, width: Math.round(v) } }, hist)
                  }
                  min={1}
                  step={32}
                  precision={0}
                  suffix="px"
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('resolution') + ' (H)'}>
                <NumberInput
                  value={cam.resolution.height}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) =>
                    updateCamera(cam.id, { resolution: { ...cam.resolution, height: Math.round(v) } }, hist)
                  }
                  min={1}
                  step={32}
                  precision={0}
                  suffix="px"
                  className="flex-1"
                />
              </PropertyRow>
            </div>
          )}
        </div>

        {/* Exposure Settings */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={t('exposure')}
            icon={IconExposure}
            isOpen={folds.exposure}
            onToggle={() => toggleFold('exposure')}
          />
          {folds.exposure && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label="ISO">
                <NumberInput
                  value={cam.exposure.iso}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) =>
                    updateCamera(cam.id, { exposure: { ...cam.exposure, iso: Math.round(v) } }, hist)
                  }
                  min={50}
                  max={25600}
                  step={100}
                  precision={0}
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('shutter')}>
                <NumberInput
                  value={cam.exposure.shutter}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) =>
                    updateCamera(cam.id, { exposure: { ...cam.exposure, shutter: v } }, hist)
                  }
                  min={0.0001}
                  max={30}
                  step={0.001}
                  precision={5}
                  suffix="s"
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('aperture')}>
                <NumberInput
                  value={cam.exposure.aperture}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) =>
                    updateCamera(cam.id, { exposure: { ...cam.exposure, aperture: v } }, hist)
                  }
                  min={0.5}
                  max={64}
                  step={0.1}
                  precision={1}
                  className="flex-1"
                />
              </PropertyRow>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={locale === 'zh' ? '元数据 (Metadata)' : 'Metadata'}
            icon={IconMetadata}
            isOpen={folds.metadata}
            onToggle={() => toggleFold('metadata')}
          />
          {folds.metadata && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label="Enabled">
                <input
                  type="checkbox"
                  className="rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] text-[var(--color-accent)] focus:ring-0 focus:outline-none cursor-pointer"
                  checked={cam.enabled}
                  onChange={(e) => updateCamera(cam.id, { enabled: e.target.checked })}
                />
              </PropertyRow>
              <PropertyRow label={locale === 'zh' ? '拍摄时刻 (Time)' : 'Capture Time'}>
                <NumberInput
                  value={cam.time ?? 0}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateCamera(cam.id, { time: v }, hist)}
                  min={0}
                  suffix="s"
                  className="flex-1"
                />
              </PropertyRow>
            </div>
          )}
        </div>
      </>
    );
  };

  // 4. Light 具体属性
  const renderLightGroup = (light: LightDef) => {
    return (
      <>
        {renderIdentityRow(light)}
        {renderTransformGroup(light)}

        {/* Light Settings */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={t('lightParams')}
            icon={IconLight}
            isOpen={folds.light}
            onToggle={() => toggleFold('light')}
          />
          {folds.light && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label={t('lightKind')}>
                <select
                  className="flex-1 h-6 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] px-1 text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
                  value={light.lightKind}
                  onChange={(e) => updateLight(light.id, { lightKind: e.target.value as LightDef['lightKind'] })}
                >
                  <option value="point">{locale === 'zh' ? '点光源 (Point)' : 'Point Light'}</option>
                  <option value="spot">{locale === 'zh' ? '聚光灯 (Spot)' : 'Spot Light'}</option>
                  <option value="directional">{locale === 'zh' ? '平行光 (Directional)' : 'Directional Light'}</option>
                  <option value="area">{locale === 'zh' ? '面光源 (Area)' : 'Area Light'}</option>
                </select>
              </PropertyRow>

              <PropertyRow label={t('lightColor')}>
                {renderColorPicker(light.color, (v, hist) => updateLight(light.id, { color: v }, hist))}
              </PropertyRow>

              <PropertyRow label={t('lightIntensity')}>
                <NumberInput
                  value={light.intensity}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateLight(light.id, { intensity: v }, hist)}
                  min={0}
                  step={0.5}
                  suffix={light.lightKind === 'directional' ? 'lux' : 'cd'}
                  className="flex-1"
                />
              </PropertyRow>

              {(light.lightKind === 'point' || light.lightKind === 'spot') && (
                <PropertyRow label={t('range')}>
                  <NumberInput
                    value={light.range ?? 10}
                    onCommitHistory={commitHistory}
                    onChange={(v, hist) => updateLight(light.id, { range: v }, hist)}
                    min={0.1}
                    suffix="m"
                    className="flex-1"
                  />
                </PropertyRow>
              )}

              {light.lightKind === 'spot' && (
                <>
                  <PropertyRow label={t('spotAngle')}>
                    <NumberInput
                      value={light.spotAngle ?? 45}
                      onCommitHistory={commitHistory}
                      onChange={(v, hist) => updateLight(light.id, { spotAngle: v }, hist)}
                      min={1}
                      max={89}
                      suffix="°"
                      className="flex-1"
                    />
                  </PropertyRow>
                  <PropertyRow label={t('spotPenumbra')}>
                    <NumberInput
                      value={light.spotPenumbra ?? 0.1}
                      onCommitHistory={commitHistory}
                      onChange={(v, hist) => updateLight(light.id, { spotPenumbra: v }, hist)}
                      min={0}
                      max={1}
                      className="flex-1"
                    />
                  </PropertyRow>
                </>
              )}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={locale === 'zh' ? '元数据 (Metadata)' : 'Metadata'}
            icon={IconMetadata}
            isOpen={folds.metadata}
            onToggle={() => toggleFold('metadata')}
          />
          {folds.metadata && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label="Enabled">
                <input
                  type="checkbox"
                  className="rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] text-[var(--color-accent)] focus:ring-0 focus:outline-none cursor-pointer"
                  checked={light.enabled}
                  onChange={(e) => updateLight(light.id, { enabled: e.target.checked })}
                />
              </PropertyRow>
              <PropertyRow label={locale === 'zh' ? '光照时刻 (Time)' : 'Light Time'}>
                <NumberInput
                  value={light.time ?? 0}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateLight(light.id, { time: v }, hist)}
                  min={0}
                  suffix="s"
                  className="flex-1"
                />
              </PropertyRow>
            </div>
          )}
        </div>
      </>
    );
  };

  // 5. Subject 具体属性
  const renderSubjectGroup = (subj: SubjectDef) => {
    return (
      <>
        {renderIdentityRow(subj)}
        {renderTransformGroup(subj)}

        {/* Geometry Settings */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={t('subjectParams')}
            icon={IconSubject}
            isOpen={folds.subject}
            onToggle={() => toggleFold('subject')}
          />
          {folds.subject && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label={t('geomType')}>
                <select
                  className="flex-1 h-6 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] px-1 text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
                  value={subj.geometry.type}
                  onChange={(e) => {
                    const type = e.target.value as SubjectDef['geometry']['type'];
                    if (type === 'box') {
                      updateSubject(subj.id, { geometry: { type: 'box', size: [1, 1, 1] } });
                    } else if (type === 'sphere') {
                      updateSubject(subj.id, { geometry: { type: 'sphere', radius: 0.5 } });
                    } else if (type === 'plane') {
                      updateSubject(subj.id, { geometry: { type: 'plane', size: [1, 1, 0] } });
                    } else {
                      updateSubject(subj.id, { geometry: { type: 'mesh', src: '' } });
                    }
                  }}
                >
                  <option value="box">{locale === 'zh' ? '立方体 (Box)' : 'Box Cube'}</option>
                  <option value="sphere">{locale === 'zh' ? '球体 (Sphere)' : 'Sphere Ball'}</option>
                  <option value="plane">{locale === 'zh' ? '平面 (Plane)' : 'Plane Sheet'}</option>
                  <option value="mesh">{locale === 'zh' ? '3D网格 (Mesh)' : '3D Mesh'}</option>
                </select>
              </PropertyRow>

              {subj.geometry.type === 'box' && (() => {
                const geom = subj.geometry;
                if (geom.type !== 'box') return null;
                return (
                  <PropertyRow label={t('geomSize')}>
                    <div className="flex-1 grid grid-cols-3 gap-1">
                      <NumberInput
                        label="X"
                        value={geom.size[0]}
                        onCommitHistory={commitHistory}
                        onChange={(v, hist) => {
                          const nextSize: [number, number, number] = [v, geom.size[1], geom.size[2]];
                          updateSubject(subj.id, { geometry: { type: 'box', size: nextSize } }, hist);
                        }}
                        min={0.1}
                        suffix="m"
                      />
                      <NumberInput
                        label="Y"
                        value={geom.size[1]}
                        onCommitHistory={commitHistory}
                        onChange={(v, hist) => {
                          const nextSize: [number, number, number] = [geom.size[0], v, geom.size[2]];
                          updateSubject(subj.id, { geometry: { type: 'box', size: nextSize } }, hist);
                        }}
                        min={0.1}
                        suffix="m"
                      />
                      <NumberInput
                        label="Z"
                        value={geom.size[2]}
                        onCommitHistory={commitHistory}
                        onChange={(v, hist) => {
                          const nextSize: [number, number, number] = [geom.size[0], geom.size[1], v];
                          updateSubject(subj.id, { geometry: { type: 'box', size: nextSize } }, hist);
                        }}
                        min={0.1}
                        suffix="m"
                      />
                    </div>
                  </PropertyRow>
                );
              })()}

              {subj.geometry.type === 'sphere' && (() => {
                const geom = subj.geometry;
                if (geom.type !== 'sphere') return null;
                return (
                  <PropertyRow label={t('geomRadius')}>
                    <NumberInput
                      value={geom.radius}
                      onCommitHistory={commitHistory}
                      onChange={(v, hist) => {
                        updateSubject(subj.id, { geometry: { type: 'sphere', radius: v } }, hist);
                      }}
                      min={0.1}
                      suffix="m"
                      className="flex-1"
                    />
                  </PropertyRow>
                );
              })()}

              {subj.geometry.type === 'plane' && (() => {
                const geom = subj.geometry;
                if (geom.type !== 'plane') return null;
                return (
                  <PropertyRow label={t('geomSize') + ' (W/H)'}>
                    <div className="flex-grow grid grid-cols-2 gap-1">
                      <NumberInput
                        label="W"
                        value={geom.size[0]}
                        onCommitHistory={commitHistory}
                        onChange={(v, hist) => {
                          const nextSize: [number, number, number] = [v, geom.size[1], geom.size[2]];
                          updateSubject(subj.id, { geometry: { type: 'plane', size: nextSize } }, hist);
                        }}
                        min={0.1}
                        suffix="m"
                      />
                      <NumberInput
                        label="H"
                        value={geom.size[1]}
                        onCommitHistory={commitHistory}
                        onChange={(v, hist) => {
                          const nextSize: [number, number, number] = [geom.size[0], v, geom.size[2]];
                          updateSubject(subj.id, { geometry: { type: 'plane', size: nextSize } }, hist);
                        }}
                        min={0.1}
                        suffix="m"
                      />
                    </div>
                  </PropertyRow>
                );
              })()}

              {subj.geometry.type === 'mesh' && (() => {
                const geom = subj.geometry;
                if (geom.type !== 'mesh') return null;
                return (
                  <>
                    <PropertyRow label={t('geomSrc')}>
                      <input
                        type="text"
                        className="flex-1 h-6 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] px-1.5 text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                        value={geom.src}
                        onChange={(e) => {
                          updateSubject(subj.id, { geometry: { type: 'mesh', src: e.target.value } });
                        }}
                        placeholder="assets/model.obj"
                      />
                    </PropertyRow>
                    {/* #WDD-gpt 2026-06-21 - 动画 clip 下拉选择（仅 USDZ 有动画时显示） */}
                    {geom.animate && (
                      <PropertyRow label={locale === 'zh' ? '动画' : 'Animation'}>
                        <select
                          className="flex-1 h-6 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] px-1 text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
                          value={geom.animationClip ?? ''}
                          onChange={(e) => {
                            const clip = e.target.value === '' ? undefined : e.target.value;
                            updateSubject(subj.id, { geometry: { ...geom, animationClip: clip } });
                          }}
                        >
                          <option value="">{locale === 'zh' ? '默认 (首个)' : 'Default (First)'}</option>
                          {/* 动画 clip 列表从模型加载后获取，这里用已知名称占位 */}
                          <option value="idle">idle</option>
                        </select>
                      </PropertyRow>
                    )}
                  </>
                );
              })()}

              <PropertyRow label={t('sampleDensity')}>
                <NumberInput
                  value={subj.sampleDensity}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateSubject(subj.id, { sampleDensity: v }, hist)}
                  min={0.5}
                  max={100}
                  step={1}
                  precision={1}
                  suffix="pts/m"
                  className="flex-1"
                />
              </PropertyRow>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={locale === 'zh' ? '元数据 (Metadata)' : 'Metadata'}
            icon={IconMetadata}
            isOpen={folds.metadata}
            onToggle={() => toggleFold('metadata')}
          />
          {folds.metadata && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label="Enabled">
                <input
                  type="checkbox"
                  className="rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] text-[var(--color-accent)] focus:ring-0 focus:outline-none cursor-pointer"
                  checked={subj.enabled}
                  onChange={(e) => updateSubject(subj.id, { enabled: e.target.checked })}
                />
              </PropertyRow>
              <PropertyRow label={locale === 'zh' ? '采样时刻 (Time)' : 'Subject Time'}>
                <NumberInput
                  value={subj.time ?? 0}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateSubject(subj.id, { time: v }, hist)}
                  min={0}
                  suffix="s"
                  className="flex-1"
                />
              </PropertyRow>
            </div>
          )}
        </div>
      </>
    );
  };

  // Group 组合/组属性：只有 transform（平移/旋转/缩放）+ 名称 + enabled
  const renderGroupGroup = (grp: GroupDef) => {
    return (
      <>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] px-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-accent)]">⊞</span>
            <span className="font-bold text-[var(--text-label)]">{grp.name}</span>
            <span className="text-[9px] uppercase text-[var(--color-text-faint)] rounded bg-[var(--color-recessed)] px-1">GROUP</span>
          </div>
        </div>
        {renderTransformGroup(grp)}
      </>
    );
  };

  // 6. Environment 默认环境设置
  const renderEnvironmentGroup = (env: EnvDef) => {
    return (
      <>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] px-3">
          <span className="font-bold text-[var(--color-text)]">
            {locale === 'zh' ? '环境与天空设置' : 'Environment & Sky'}
          </span>
          <span className="text-[var(--text-label)] font-mono text-[var(--color-text-dim)] uppercase select-none opacity-75">
            Global
          </span>
        </div>

        {/* Ambient Settings */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={t('envParams')}
            icon={IconEnvironment}
            isOpen={folds.envAmbient}
            onToggle={() => toggleFold('envAmbient')}
          />
          {folds.envAmbient && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label={t('hdri')}>
                <input
                  type="text"
                  className="flex-1 h-6 rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] px-1.5 text-[11px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                  value={env.hdri ?? ''}
                  onChange={(e) => updateEnv({ hdri: e.target.value || undefined })}
                  placeholder="None (Default Environment)"
                />
              </PropertyRow>
              <PropertyRow label={t('ambientIntensity')}>
                <NumberInput
                  value={env.ambientIntensity}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateEnv({ ambientIntensity: v }, hist)}
                  min={0}
                  max={20}
                  step={0.1}
                  className="flex-1"
                />
              </PropertyRow>
            </div>
          )}
        </div>

        {/* Ground Settings */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={t('ground')}
            icon={IconGround}
            isOpen={folds.envGround}
            onToggle={() => toggleFold('envGround')}
          />
          {folds.envGround && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label={t('enableGround')}>
                <input
                  type="checkbox"
                  className="rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] text-[var(--color-accent)] focus:ring-0 focus:outline-none cursor-pointer"
                  checked={env.ground.enabled}
                  onChange={(e) => updateEnv({ ground: { ...env.ground, enabled: e.target.checked } })}
                />
              </PropertyRow>
              <PropertyRow label={t('floorHeight')}>
                <NumberInput
                  value={env.ground.y}
                  onCommitHistory={commitHistory}
                  onChange={(v, hist) => updateEnv({ ground: { ...env.ground, y: v } }, hist)}
                  suffix="m"
                  className="flex-1"
                />
              </PropertyRow>
              <PropertyRow label={t('floorColor')}>
                {renderColorPicker(env.ground.color, (v, hist) =>
                  updateEnv({ ground: { ...env.ground, color: v } }, hist)
                )}
              </PropertyRow>
            </div>
          )}
        </div>

        {/* Fog Settings */}
        <div className="border-b border-[var(--color-panel-border)]">
          <CategoryHeader
            title={locale === 'zh' ? '大气雾效 (Atmosphere Fog)' : 'Atmosphere Fog'}
            icon={IconEnvironment}
            isOpen={folds.envFog}
            onToggle={() => toggleFold('envFog')}
          />
          {folds.envFog && (
            <div className="flex flex-col gap-1 px-0 py-2">
              <PropertyRow label={locale === 'zh' ? '启用雾效 (Enable)' : 'Enable Fog'}>
                <input
                  type="checkbox"
                  className="rounded-sm bg-[var(--color-recessed)] border border-[var(--color-panel-border)] text-[var(--color-accent)] focus:ring-0 focus:outline-none cursor-pointer"
                  checked={!!env.fog}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateEnv({
                        fog: { color: 0x222222, near: 5, far: 30 },
                      });
                    } else {
                      updateEnv({ fog: undefined });
                    }
                  }}
                />
              </PropertyRow>
              {env.fog && (
                <>
                  <PropertyRow label={locale === 'zh' ? '雾气颜色 (Color)' : 'Fog Color'}>
                    {renderColorPicker(env.fog.color, (v, hist) =>
                      updateEnv({ fog: { ...env.fog!, color: v } }, hist)
                    )}
                  </PropertyRow>
                  <PropertyRow label={locale === 'zh' ? '起始距离 (Near)' : 'Start Distance'}>
                    <NumberInput
                      value={env.fog.near}
                      onCommitHistory={commitHistory}
                      onChange={(v, hist) => updateEnv({ fog: { ...env.fog!, near: v } }, hist)}
                      min={0.1}
                      suffix="m"
                      className="flex-1"
                    />
                  </PropertyRow>
                  <PropertyRow label={locale === 'zh' ? '消散距离 (Far)' : 'End Distance'}>
                    <NumberInput
                      value={env.fog.far}
                      onCommitHistory={commitHistory}
                      onChange={(v, hist) => updateEnv({ fog: { ...env.fog!, far: v } }, hist)}
                      min={0.2}
                      suffix="m"
                      className="flex-1"
                    />
                  </PropertyRow>
                </>
              )}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-panel)] text-[var(--color-text)] overflow-y-auto overflow-x-hidden min-w-0">
      {isMultiSelect ? (
        renderMultiSelectGroup()
      ) : entity ? (
        entity.kind === 'camera' ? (
          renderCameraGroup(entity as CameraDef)
        ) : entity.kind === 'light' ? (
          renderLightGroup(entity as LightDef)
        ) : entity.kind === 'subject' ? (
          renderSubjectGroup(entity as SubjectDef)
        ) : entity.kind === 'group' ? (
          renderGroupGroup(entity as GroupDef)
        ) : (
          renderEnvironmentGroup(scene.env)
        )
      ) : (
        renderEnvironmentGroup(scene.env)
      )}
    </div>
  );
}
