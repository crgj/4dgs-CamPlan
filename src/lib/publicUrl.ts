export function publicUrl(path: string): string {
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  if (path.startsWith(import.meta.env.BASE_URL)) return path;
  // #WDD-gpt  2026-06-21 - public 目录资源必须跟随 Vite base，兼容 GitHub Pages 子路径和本地 dev
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
