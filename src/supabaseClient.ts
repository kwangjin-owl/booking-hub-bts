import { createClient } from '@supabase/supabase-js'

/**
 * Vercel에 등록한 환경변수를 사용합니다.
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 *
 * 환경변수가 없으면(로컬에서 .env 파일을 안 만든 경우 등) 기존 값으로 폴백합니다.
 * VITE_ 접두사가 붙은 값은 빌드 시점에 번들에 박히므로,
 * Vercel에서 값을 바꾼 뒤에는 반드시 재배포해야 반영됩니다.
 */
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://hdvfzyxwzlrcxfqgfzkq.supabase.co'

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkdmZ6eXh3emxyY3hmcWdmemtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMTQ1MDgsImV4cCI6MjEwMzg5MDUwOH0.4dAN_ldPKbvQob7CSAHhO0MeCxm2dHIkUnmOZilXJrY'

if (!supabaseUrl || !supabaseAnonKey) {
  // 빌드가 잘못되면 화면이 하얗게만 뜨므로, 콘솔에 원인을 남깁니다.
  console.error(
    '[supabase] 환경변수가 비어 있습니다. Vercel의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 설정과 재배포 여부를 확인하세요.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 새로고침해도 로그인 상태 유지
    persistSession: true,
    autoRefreshToken: true,
    // 구글에서 돌아온 URL(?code=... 또는 #access_token=...)을 자동으로 세션으로 교환
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
