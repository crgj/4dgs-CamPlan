import { rm } from 'node:fs/promises';

const generatedPaths = [
  'docs/index.html',
  'docs/assets',
  'docs/library',
  'docs/favicon.svg',
  'docs/.nojekyll',
];

// #WDD-gpt  2026-06-21 - docs 用作 GitHub Pages 静态发布目录，只清理构建产物，避免误删手写文档
await Promise.all(
  generatedPaths.map((path) => rm(path, { recursive: true, force: true })),
);
