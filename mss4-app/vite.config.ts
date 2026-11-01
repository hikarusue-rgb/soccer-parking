import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 公開先: https://hikarusue-rgb.github.io/soccer-parking/mss4/
export default defineConfig({
  base: "/soccer-parking/mss4/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  preview: { host: "127.0.0.1", port: 4174, strictPort: true },
});
