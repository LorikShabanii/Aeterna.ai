import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  // Rust's build output under src-tauri/target churns constantly during
  // `cargo build` and briefly locks files on Windows — Vite's watcher
  // crashing on it (EBUSY) is a well-known Tauri+Vite gotcha.
  server: {
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})

export default config
