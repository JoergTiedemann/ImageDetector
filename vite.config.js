import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
//  base: "/yolo-object-detection-onnxruntime-web/",

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss()
  ],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
  server: {
  open: true
  },
  base: '/',   // statt '/yolo-object-detection-onnxruntime-web/'
  build: { outDir: 'dist' }

})

