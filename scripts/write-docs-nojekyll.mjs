import { mkdir, writeFile } from 'node:fs/promises';

// #WDD-gpt  2026-06-21 - GitHub Pages 发布 Vite 产物时关闭 Jekyll 处理，确保下划线路径和静态资源原样服务
await mkdir('docs', { recursive: true });
await writeFile('docs/.nojekyll', '');
