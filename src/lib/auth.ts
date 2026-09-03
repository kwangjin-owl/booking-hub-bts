/**
 * 관리자 판별을 한 곳에서만 관리한다.
 * 관리자를 늘리려면 이 배열에 이메일을 추가하고,
 * Supabase 의 is_admin() 함수도 같이 고쳐야 한다.
 * (화면만 고치면 DB 가 막기 때문에 실제로는 동작하지 않는다)
 */
export const ADMIN_EMAILS = ['kwangjin.owl@gmail.com']

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
