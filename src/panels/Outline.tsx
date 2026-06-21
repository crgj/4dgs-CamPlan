/**
 * #WDD -gemini 2026-06-19 增加多语言翻译与局部中文翻译占位，重构 Outliner 的多停靠包装
 * 严格按照 Unreal Editor 5.8 UI 规范：
 * - 紧凑高密度布局（行高 22px，字体 11-12px）
 * - 暗色灰调面层，高亮行左侧带蓝条 (var(--color-accent))
 * - 白色填充矢量 SVG 图标
 * - 双击重命名（行内 Input），回车/失焦保存，Esc 取消
 * - 眼睛图标一键切换 enabled 显隐状态
 * - 顶部集成 Unreal 风格 Search 搜索框过滤实体
 */
import React, { useState, useRef, useEffect } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import type { AnyEntity, EntityId } from '@/types';

export function Outline() {
  const { t, locale } = useTranslation();
  const {
    scene,
    selection,
    select,
    selectRange,
    selectSubtree,
    reparent,
    reparentMany,
    removeEntity,
    renameEntity,
    updateCamera,
    updateLight,
    updateSubject,
    updateGroup,
    duplicateEntity,
    addGroup,
    enterGroupEdit,
    focusSelectedViewport,
  } = usePlanner();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<EntityId | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // T-028：类型过滤
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set(['camera', 'light', 'subject', 'group']));
  const allTypeFilters = ['camera', 'light', 'subject', 'group'] as const;
  const isAllTypesActive = allTypeFilters.every((kind) => typeFilter.has(kind));
  const toggleTypeFilter = (kind: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };
  const setAllTypeFilters = () => {
    setTypeFilter((prev) => (prev.size === allTypeFilters.length ? new Set() : new Set(allTypeFilters)));
  };

  // T-028：右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: EntityId } | null>(null);

  // T-028：拖拽改父级
  const [dragOverId, setDragOverId] = useState<EntityId | null>(null);

  // 实体扁平列表组合
  const allEntities: AnyEntity[] = [
    ...scene.cameras,
    ...scene.lights,
    ...scene.subjects,
    ...(scene.groups ?? []),
  ];

  // 搜索过滤 + 类型过滤（T-028）
  const filteredEntities = allEntities.filter((e) => {
    if (!typeFilter.has(e.kind)) return false;
    return e.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 双击进入编辑
  const handleDoubleClick = (entity: AnyEntity) => {
    setEditingId(entity.id);
    setEditName(entity.name);
  };

  // 聚焦输入框
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // 保存重命名
  const handleSaveRename = (id: EntityId) => {
    if (editName.trim()) {
      renameEntity(id, editName.trim());
    }
    setEditingId(null);
  };

  // 键盘操作响应
  const handleKeyDown = (e: React.KeyboardEvent, id: EntityId) => {
    if (e.key === 'Enter') {
      handleSaveRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // 眼睛控制 enabled
  const handleToggleVisible = (e: React.MouseEvent, entity: AnyEntity) => {
    e.stopPropagation(); // 阻止触发选中
    const nextVal = !entity.enabled;
    if (entity.kind === 'camera') {
      updateCamera(entity.id, { enabled: nextVal });
    } else if (entity.kind === 'light') {
      updateLight(entity.id, { enabled: nextVal });
    } else if (entity.kind === 'subject') {
      updateSubject(entity.id, { enabled: nextVal });
    } else if (entity.kind === 'group') {
      updateGroup(entity.id, { enabled: nextVal });
    }
  };

  // 单个删除
  const handleDelete = (e: React.MouseEvent, id: EntityId) => {
    e.stopPropagation();
    removeEntity(id);
  };

  // SVG 图标生成器
  const getIcon = (kind: string) => {
    const baseClass = 'w-3.5 h-3.5 fill-[var(--color-text-dim)] shrink-0';
    if (kind === 'camera') {
      return (
        <svg className={baseClass} viewBox="0 0 16 16">
          <path d="M10.5 4h-5L4.5 5.5h-2A1.5 1.5 0 0 0 1 7v5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5h-2z" />
          <circle cx="8" cy="9.5" r="2.5" />
        </svg>
      );
    }
    if (kind === 'light') {
      return (
        <svg className={baseClass} viewBox="0 0 16 16">
          <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 1c.276 0 .5-.224.5-.5V11a.5.5 0 0 0-1 0v1.5c0 .276.224.5.5.5zM3.05 11.95a.5.5 0 0 0 .707 0l1.06-1.06a.5.5 0 1 0-.707-.708l-1.06 1.06a.5.5 0 0 0 0 .708zM1.5 8.5H3a.5.5 0 0 0 0-1H1.5a.5.5 0 0 0 0 1zm1.55-3.55a.5.5 0 0 0 0-.707l-1.06-1.061a.5.5 0 1 0-.707.707l1.06 1.06a.5.5 0 0 0 .707 0zm5-3.45a.5.5 0 0 0 .5-.5V1a.5.5 0 0 0-1 0v1.5c0 .276.224.5.5.5zm3.95 1.95a.5.5 0 0 0 .707 0l1.06-1.06a.5.5 0 1 0-.707-.707l-1.06 1.06a.5.5 0 0 0 0 .707zM14.5 7.5H13a.5.5 0 0 0 0 1h1.5a.5.5 0 0 0 0-1zm-1.55 3.55a.5.5 0 0 0 0 .707l1.06 1.06a.5.5 0 0 0 .707 0 .5.5 0 0 0 0-.707l-1.06-1.06a.5.5 0 0 0-.707 0z" />
        </svg>
      );
    }
    if (kind === 'group') {
      // 组合：文件夹/容器图标
      return (
        <svg className={baseClass} viewBox="0 0 16 16">
          <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2a1.5 1.5 0 0 1 1.06.44L8.2 3.5H13A1.5 1.5 0 0 1 14.5 5v6.5A1.5 1.5 0 0 1 13 13H3A1.5 1.5 0 0 1 1.5 11.5v-8z" />
        </svg>
      );
    }
    // subject
    return (
      <svg className={baseClass} viewBox="0 0 16 16">
        <path d="M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.96l6.154-2.46-6-.372zm-6.34 3.73v6.082l5.5 2.2a.5.5 0 0 0 .372 0l5.5-2.2V4.843L8 7.292 1.846 4.843z" />
      </svg>
    );
  };

  // WDD -gemini 2026-06-19 增加 Outliner 实体折叠状态集
  const [collapsedIds, setCollapsedIds] = useState<Set<EntityId>>(new Set());

  const toggleCollapse = (e: React.MouseEvent, id: EntityId) => {
    e.stopPropagation();
    const next = new Set(collapsedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setCollapsedIds(next);
  };

  // 递归渲染树节点
  const renderNode = (entity: AnyEntity, depth: number): React.ReactNode => {
    const children = allEntities.filter((e) => e.parentId === entity.id);
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedIds.has(entity.id);

    const isSelected = selection.includes(entity.id);
    const isEditing = editingId === entity.id;

    const childNodes = hasChildren && !isCollapsed
      ? children.map((child) => renderNode(child, depth + 1))
      : null;

    // Unreal 风格：缩进 12px
    const indent = depth * 14 + 6;

    const row = (
      <div
        key={entity.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-planner-entity', entity.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-planner-entity')) {
            e.preventDefault();
            setDragOverId(entity.id);
          }
        }}
        onDragLeave={() => {
          if (dragOverId === entity.id) setDragOverId(null);
        }}
        onDrop={(e) => {
          const draggedId = e.dataTransfer.getData('application/x-planner-entity');
          e.preventDefault();
          setDragOverId(null);
          if (!draggedId || draggedId === entity.id) return;
          // #WDD-gpt 2026-06-21 - 多选拖拽：拖动的实体在当前选择集中时，把全部选中实体
          // 一起 reparent 到目标；否则仅移动被拖动的单个实体。
          const movingIds =
            selection.includes(draggedId as EntityId) && selection.length > 1
              ? selection.filter((id) => id !== entity.id)
              : [draggedId as EntityId];
          if (movingIds.length > 1) {
            reparentMany(movingIds, entity.id, true);
          } else {
            reparent(draggedId as EntityId, entity.id, true);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY, id: entity.id });
        }}
        onClick={(e) => {
          // #WDD-gpt 2026-06-21 - Shift 范围多选 / Ctrl+Cmd 切换 / 普通单击
          // 组合（父物体）普通单击 = 选中它及其全部子代（选父=选整组）；Ctrl+click 仅切换自身。
          if (e.shiftKey) selectRange(entity.id);
          else if (entity.kind === 'group' && !e.ctrlKey && !e.metaKey) selectSubtree(entity.id);
          else select(entity.id, e.ctrlKey || e.metaKey);
        }}
        onDoubleClick={() => handleDoubleClick(entity)}
        className={`group relative flex h-[var(--row-h)] items-center gap-2 pr-3 text-[var(--text-base)] cursor-pointer transition-colors outline-row-hover ${
          isSelected
            ? 'bg-[var(--color-select-fill)] text-[var(--color-text)]'
            : 'text-[var(--color-text)]'
        } ${!entity.enabled ? 'opacity-40' : ''} ${dragOverId === entity.id ? 'ring-1 ring-inset ring-[var(--color-accent)]' : ''}`}
        style={{
          height: 'var(--row-h)',
          paddingLeft: `${indent}px`,
        }}
      >
        {/* 选中高亮左垂直蓝条 */}
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-accent)]" />
        )}

        {/* 折叠箭头 */}
        <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleCollapse(e, entity.id)}
              className="p-0.5 hover:bg-[var(--color-panel-border)] rounded-sm cursor-pointer text-[var(--color-text-dim)] flex items-center justify-center border-none bg-transparent"
            >
              <svg
                className={`w-2.0 h-2.0 fill-current transform transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                viewBox="0 0 24 24"
              >
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
          ) : (
            <div className="w-2.0 h-2.0" />
          )}
        </div>

        {/* 眼睛状态图标 */}
        <button
          type="button"
          onClick={(e) => handleToggleVisible(e, entity)}
          className="p-0.5 hover:bg-[var(--color-panel-border)] rounded-sm text-[var(--color-text-dim)] cursor-pointer shrink-0 border-none bg-transparent"
        >
          {entity.enabled ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
              <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
              <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
              <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a10.16 10.16 0 0 0-1.096.059L5.834 3.633L6.902 4.7a3.467 3.467 0 0 1 3.598 3.6l1.06 1.06c.71-.628 1.341-1.396 1.8-2.16zm-5.077 2.261A10.74 10.74 0 0 1 8 13.5c-5 0-8-5.5-8-5.5a10.17 10.17 0 0 1 1.096-.06l1.242 1.243a4.475 4.475 0 0 0 5.944 5.945l1.06 1.06zM8 5.5a2.5 2.5 0 0 0-2.5 2.5c0 .35.07.68.2 1.001l3.3-3.3A2.464 2.464 0 0 0 8 5.5zm-3 4.5A2.5 2.5 0 0 0 7.5 8a2.5 2.5 0 0 0-.5-1.5l-3.3 3.3a2.47 2.47 0 0 0 1.3.2z" />
              <path d="M1 1l14 14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>

        {/* 类别图标 */}
        {getIcon(entity.kind)}

        {/* 双击编辑名称 */}
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            className="h-5 flex-1 bg-[var(--color-recessed)] border border-[var(--color-accent)] text-[var(--color-text)] text-[var(--text-base)] px-1 rounded-sm focus:outline-none"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => handleSaveRename(entity.id)}
            onKeyDown={(e) => handleKeyDown(e, entity.id)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate select-none text-[var(--color-text)] text-[11px] font-medium">
            {entity.name}
          </span>
        )}

        {/* 悬浮显示的快捷删除图标 */}
        <button
          type="button"
          onClick={(e) => handleDelete(e, entity.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--color-panel-border)] rounded-sm text-[var(--color-text-dim)] hover:text-red-400 cursor-pointer shrink-0 border-none bg-transparent"
          title={locale === 'zh' ? '删除实体' : 'Delete Entity'}
        >
          <svg className="w-3 h-3 fill-current" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
          </svg>
        </button>
      </div>
    );

    return (
      <React.Fragment key={entity.id}>
        {row}
        {childNodes}
      </React.Fragment>
    );
  };

  // 搜索过滤扁平渲染辅助
  const renderFlatNode = (entity: AnyEntity): React.ReactNode => {
    const isSelected = selection.includes(entity.id);
    const isEditing = editingId === entity.id;

    return (
      <div
        key={entity.id}
        onClick={(e) => {
          // #WDD-gpt 2026-06-21 - Shift 范围多选 / Ctrl+Cmd 切换 / 普通单击
          // 组合（父物体）普通单击 = 选中它及其全部子代（选父=选整组）；Ctrl+click 仅切换自身。
          if (e.shiftKey) selectRange(entity.id);
          else if (entity.kind === 'group' && !e.ctrlKey && !e.metaKey) selectSubtree(entity.id);
          else select(entity.id, e.ctrlKey || e.metaKey);
        }}
        onDoubleClick={() => handleDoubleClick(entity)}
        className={`group relative flex h-[var(--row-h)] items-center gap-2 px-3 pr-3 text-[var(--text-base)] cursor-pointer transition-colors outline-row-hover ${
          isSelected
            ? 'bg-[var(--color-select-fill)] text-[var(--color-text)]'
            : 'text-[var(--color-text)]'
        } ${!entity.enabled ? 'opacity-40' : ''}`}
        style={{ height: 'var(--row-h)' }}
      >
        {isSelected && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-accent)]" />
        )}
        <div className="w-3.5 h-3.5 shrink-0" />
        <button
          type="button"
          onClick={(e) => handleToggleVisible(e, entity)}
          className="p-0.5 hover:bg-[var(--color-panel-border)] rounded-sm text-[var(--color-text-dim)] cursor-pointer shrink-0 border-none bg-transparent"
        >
          {entity.enabled ? (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
              <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
              <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 16 16">
              <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a10.16 10.16 0 0 0-1.096.059L5.834 3.633L6.902 4.7a3.467 3.467 0 0 1 3.598 3.6l1.06 1.06c.71-.628 1.341-1.396 1.8-2.16zm-5.077 2.261A10.74 10.74 0 0 1 8 13.5c-5 0-8-5.5-8-5.5a10.17 10.17 0 0 1 1.096-.06l1.242 1.243a4.475 4.475 0 0 0 5.944 5.945l1.06 1.06zM8 5.5a2.5 2.5 0 0 0-2.5 2.5c0 .35.07.68.2 1.001l3.3-3.3A2.464 2.464 0 0 0 8 5.5zm-3 4.5A2.5 2.5 0 0 0 7.5 8a2.5 2.5 0 0 0-.5-1.5l-3.3 3.3a2.47 2.47 0 0 0 1.3.2z" />
              <path d="M1 1l14 14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
        {getIcon(entity.kind)}
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            className="h-5 flex-1 bg-[var(--color-recessed)] border border-[var(--color-accent)] text-[var(--color-text)] text-[var(--text-base)] px-1 rounded-sm focus:outline-none"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => handleSaveRename(entity.id)}
            onKeyDown={(e) => handleKeyDown(e, entity.id)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate select-none text-[var(--color-text)] text-[11px] font-medium">
            {entity.name}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => handleDelete(e, entity.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--color-panel-border)] rounded-sm text-[var(--color-text-dim)] hover:text-red-400 cursor-pointer shrink-0 border-none bg-transparent"
          title={locale === 'zh' ? '删除实体' : 'Delete Entity'}
        >
          <svg className="w-3 h-3 fill-current" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
          </svg>
        </button>
      </div>
    );
  };

  // 找出根级实体
  const rootEntities = allEntities.filter((e) => {
    if (!e.parentId) return true;
    return !allEntities.some((p) => p.id === e.parentId);
  });

  return (
    <div className="flex h-full flex-col bg-[var(--color-panel)] text-[var(--color-text)]">
      {/* 搜索框 + 类型过滤（T-028） */}
      <div className="shrink-0 border-b border-[var(--color-panel-border)] bg-[var(--color-panel)] px-2 py-2">
        {/* #WDD-gpt  2026-06-21 - 大纲顶部对齐 ContentBrowser：第一行搜索，第二行文字分类 */}
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
            type="text"
            className="h-full min-w-0 flex-1 bg-transparent text-[11px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-faint)]"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={setAllTypeFilters}
            className={`h-6 rounded-[var(--radius-sm)] border px-2 text-[10px] ${
              isAllTypesActive
                ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]'
                : 'border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
            }`}
          >
            {locale === 'zh' ? '全部' : 'All'}
          </button>
          {allTypeFilters.map((kind) => {
            const labels = {
              camera: locale === 'zh' ? '相机' : 'Camera',
              light: locale === 'zh' ? '灯光' : 'Light',
              subject: locale === 'zh' ? '主体' : 'Subject',
              group: locale === 'zh' ? '组' : 'Group',
            };
            return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleTypeFilter(kind)}
              aria-pressed={typeFilter.has(kind)}
              className={`h-6 rounded-[var(--radius-sm)] border px-2 text-[10px] ${
                typeFilter.has(kind)
                  ? 'border-[var(--color-accent)] bg-[var(--color-select-fill)] text-[var(--color-text)]'
                  : 'border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
              }`}
              title={kind}
            >
              {labels[kind]}
            </button>
            );
          })}
        </div>
      </div>

      {/* 实体树状/扁平列表容器 */}
      <div className="flex-1 overflow-y-auto px-0 py-1 select-none">
        {allEntities.length === 0 ? (
          <div className="p-3 text-center text-[var(--text-label)] text-[var(--color-text-faint)]">
            {locale === 'zh' ? '当前场景无实体' : 'No entities in current scene'}
          </div>
        ) : searchQuery ? (
          // 搜索模式下：使用扁平高亮列表
          filteredEntities.length === 0 ? (
            <div className="p-3 text-center text-[var(--text-label)] text-[var(--color-text-faint)]">
              {locale === 'zh' ? '没有匹配的实体' : 'No entities match search'}
            </div>
          ) : (
            filteredEntities.map((entity) => renderFlatNode(entity))
          )
        ) : (
          // 正常模式下：使用递归树级联渲染
          rootEntities.map((e) => renderNode(e, 0))
        )}
      </div>

      {/* T-028：右键上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          id={contextMenu.id}
          isGroup={allEntities.find((e) => e.id === contextMenu.id)?.kind === 'group'}
          onClose={() => setContextMenu(null)}
          onRename={(id) => {
            const e = allEntities.find((en) => en.id === id);
            if (e) handleDoubleClick(e);
          }}
          onDuplicate={(id) => duplicateEntity(id)}
          onDelete={(id) => removeEntity(id)}
          onFocus={() => {
            select(contextMenu.id);
            focusSelectedViewport();
          }}
          onEnterEdit={(id) => enterGroupEdit(id)}
          onGroupSelection={() => {
            // 把当前选中 + 右键目标纳入一个新建 group
            const ids = new Set(selection);
            ids.add(contextMenu.id);
            const grp = addGroup();
            for (const eid of ids) reparent(eid, grp.id, true);
          }}
          onDetach={(id) => reparent(id, null, true)}
          canDetach={Boolean(allEntities.find((e) => e.id === contextMenu.id)?.parentId)}
          locale={locale}
        />
      )}
    </div>
  );
}

/** T-028 右键上下文菜单（模块级组件）。 */
function ContextMenu({
  x,
  y,
  id,
  isGroup,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
  onFocus,
  onEnterEdit,
  onGroupSelection,
  onDetach,
  canDetach,
  locale,
}: {
  x: number;
  y: number;
  id: EntityId;
  isGroup: boolean;
  onClose: () => void;
  onRename: (id: EntityId) => void;
  onDuplicate: (id: EntityId) => void;
  onDelete: (id: EntityId) => void;
  onFocus: () => void;
  onEnterEdit: (id: EntityId) => void;
  onGroupSelection: () => void;
  onDetach: (id: EntityId) => void;
  canDetach: boolean;
  locale: 'zh' | 'en';
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [onClose]);

  const items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[] = [
    { label: locale === 'zh' ? '聚焦 (F)' : 'Focus (F)', onClick: onFocus },
    { label: locale === 'zh' ? '重命名' : 'Rename', onClick: () => onRename(id) },
    { label: locale === 'zh' ? '复制 (Ctrl+D)' : 'Duplicate (Ctrl+D)', onClick: () => onDuplicate(id) },
    // 组合专属：进入隔离编辑
    ...(isGroup
      ? [{ label: locale === 'zh' ? '进入组合编辑' : 'Enter Group Edit', onClick: () => onEnterEdit(id) }]
      : []),
    // 把选中对象组合成组
    { label: locale === 'zh' ? '组合到新建组' : 'Group Selection', onClick: onGroupSelection },
    { label: locale === 'zh' ? '脱离父级' : 'Detach from Parent', onClick: () => onDetach(id), disabled: !canDetach },
    { label: locale === 'zh' ? '删除' : 'Delete', onClick: () => onDelete(id), danger: true },
  ];

  return (
    <div
      className="fixed z-[200] min-w-[160px] py-1 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(24,24,24,0.96)] shadow-2xl"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`flex w-full items-center px-3 py-1.5 text-left text-[11px] transition-colors ${
            item.disabled
              ? 'cursor-not-allowed text-[var(--color-text-faint)] opacity-50'
              : item.danger
                ? 'text-[#e05050] hover:bg-[var(--color-accent)] hover:text-white'
                : 'text-[var(--color-text-dim)] hover:bg-[var(--color-accent)] hover:text-white'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
