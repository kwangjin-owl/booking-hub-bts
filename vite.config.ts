import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Supabase 값은 src/supabaseClient.ts 에서 import.meta.env 로 직접 읽는다.
// 예전에 있던 define 블록(__SUPABASE_URL__ 등)은 참조하는 곳이 없어 지웠다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
