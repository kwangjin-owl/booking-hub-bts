import { createClient } from '@supabase/supabase-js'

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 런타임에 config.json에서 환경 변수 로드 (Vercel 배포 시 필요)
export const initializeSupabase = async () => {
  try {
    const response = await fetch('/config.json')
    const config = await response.json()
    if (config.VITE_SUPABASE_URL) {
      supabaseUrl = config.VITE_SUPABASE_URL
    }
    if (config.VITE_SUPABASE_ANON_KEY) {
      supabaseAnonKey = config.VITE_SUPABASE_ANON_KEY
    }
  } catch (e) {
    console.warn('config.json 로드 실패, 환경 변수 사용')
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 환경 변수 미설정:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey,
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
