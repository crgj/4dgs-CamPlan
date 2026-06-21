# UE5.8 UI 参考来源与取色说明

本文件记录"Planner UI 严格参考 UE5.8"这一决策的证据来源，以及色值的取定方法。
供后续 coder 校对/微调主题时溯源。

## 权威来源

1. **Unreal Engine 5.8 Release Notes — Visual UI Refresh**
   5.8 明确更新了界面以匹配"现代 Unreal Editor 暗色主题"，并对 Details Panel 做了整理。
   https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-5-8-release-notes

2. **Unreal Editor Interface（5.8 官方文档）**
   描述主编辑器骨架：Menu/Toolbar、视口、Outliner（右上层级树）、Details（选中属性）。
   https://dev.epicgames.com/documentation/unreal-engine/unreal-editor-interface

3. **Details Panel Customizations**
   Details Panel 基于 Slate，分类折叠组 + 属性行的呈现方式。
   https://dev.epicgames.com/documentation/unreal-engine/details-panel-customizations-in-unreal-engine

4. **EStyleColor 枚举 + Dark.json 主题文件**
   权威配色定义在 `Engine/Content/Slate/Themes/Dark.json`（线性色，需转 sRGB），
   以及 `EStyleColor` 枚举映射。
   https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/SlateCore/EStyleColor

## 色值取定方法

UE 没有公开的"官方 hex 色板速查表"。色值来源：
- Dark.json 存的是**线性**归一化浮点（如 0.04, 0.04, 0.04），需做 linear→sRGB 换算；
- 社区与主题编辑器实测的近似值高度一致：最深背景约 `#1a1a1a`/`#151515`、面板约 `#252525`、
  抬升约 `#2d2d2d`/`#303030`、选中蓝约 `#0a8fef`/`#0078d7` 区间、文本偏冷灰约 `#c0c0c0`。

Planner 采用上述实测近似值的"折中档"，写入 `src/styles/index.css` 的 `@theme`。
若未来拿到本地 UE 安装的 Dark.json 精确值，按 linear→sRGB 换算后更新变量即可（结构不变）。

## 轴色约定（X/Y/Z）

UE 与多数 DCC 一致：X=红、Y=绿、Z=蓝。Planner 在 gizmo、向量输入前导色块、
坐标轴指示器统一沿用，色值取 UE 轴色近似：X `#c83838`、Y `#4cae50`、Z `#0a8fef`。

## 与 UE 的有意差异（务必在 UI 注明）

- **视口转视角用 RMB**（UE 用 LMB）。原因：我们 LMB 保留给选择/框选，与 Web 习惯一致；
  HANDBOOK 与视口提示需写明。
- 其余导航（平移、缩放）与选择、gizmo 模式键（W/E/R）、聚焦（F）与 UE 一致。

## 校对流程

做完任一面板后：
1. 截图 Planner 面板。
2. 与 UE5.8 对应面板（官方文档截图或本地编辑器）并排对比。
3. 不符项先调 CSS 变量/间距，不改 ue5-ui-reference 约定；确需改约定则更新本文件并记 LOG。
