import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
// 注意：测试配置见 vitest.config.ts（分离，避免开发服加载测试依赖）。
export default defineConfig({
  // #WDD-gpt  2026-06-21 - GitHub Pages 项目页部署在 /4dgs-CamPlan/ 子路径，构建资源必须带 base 才不会 404
  base: '/4dgs-CamPlan/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
