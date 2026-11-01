import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 公開先: https://hikarusue-rgb.github.io/soccer-parking/mss4/
// テスト環境（vite build --mode testenv）: https://hikarusue-rgb.github.io/soccer-parking/mss4-test/
export default defineConfig(({ mode }) => {
  const testenv = mode === "testenv";
  return {
    base: testenv ? "/soccer-parking/mss4-test/" : "/soccer-parking/mss4/",
    plugins: [react()],
    build: { outDir: testenv ? "dist-test" : "dist", emptyOutDir: true, sourcemap: false },
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
  };
});
