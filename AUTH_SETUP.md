# Google 로그인 + Admin 인증 설정 가이드

## 1단계: Supabase에서 Google OAuth 설정

### 1.1 Google Cloud Console 설정
1. https://console.cloud.google.com 접속
2. 프로젝트 생성 (또는 기존 프로젝트 선택)
3. "OAuth 2.0 클라이언트 ID" 생성:
   - 애플리케이션 유형: 웹 애플리케이션
   - 승인된 리다이렉트 URI 추가:
     - 개발: `https://localhost:5173/auth/callback`
     - 배포: `https://your-domain.vercel.app/auth/callback`
4. 클라이언트 ID와 클라이언트 보안 비밀 복사

### 1.2 Supabase 대시보드 설정
1. Supabase 프로젝트 대시보드 → `Authentication` → `Providers`
2. `Google` 활성화
3. 클라이언트 ID와 보안 비밀 붙여넣기
4. 저장

## 2단계: RLS 정책 업데이트

### 현재 정책 (모든 사용자 접근 가능)
```sql
create policy "demo read" on bookings
  for select to anon
  using (true);

create policy "demo insert" on bookings
  for insert to anon
  with check (true);

create policy "demo update" on bookings
  for update to anon
  using (true)
  with check (true);
```

### 새로운 정책 (인증된 사용자만)
Supabase SQL Editor에서 기존 정책 3개를 **먼저 삭제** 후, 아래를 실행:

```sql
-- 기존 정책 삭제 (필요시)
drop policy if exists "demo read" on bookings;
drop policy if exists "demo insert" on bookings;
drop policy if exists "demo update" on bookings;

-- 새 정책: 인증된 사용자만 접근
create policy "authenticated read" on bookings
  for select to authenticated
  using (true);

create policy "authenticated insert" on bookings
  for insert to authenticated
  with check (true);

create policy "authenticated update" on bookings
  for update to authenticated
  using (true)
  with check (true);
```

## 3단계: 테스트

### Admin 로그인 (성공해야 함)
1. `http://localhost:5173` 열기
2. "Google로 로그인" 클릭
3. `kwangjin.owl@gmail.com`으로 로그인
4. 앱이 정상적으로 열려야 함

### 다른 이메일로 로그인 (거부되어야 함)
1. 시크릿 모드/다른 브라우저에서 시작
2. `http://localhost:5173` 열기
3. "Google로 로그인" 클릭
4. 다른 이메일로 로그인 시도
5. 에러 메시지: "접근 거부: [이메일]은 허가되지 않은 이메일입니다."

## 배포 시 주의사항

### Vercel 배포
1. `npm run build` 테스트
2. `.env` 환경변수는 Vercel 대시보드에서 설정
3. Google OAuth Redirect URI에 실제 Vercel 도메인 추가
   ```
   https://your-project.vercel.app/auth/callback
   ```

### 추가 Admin 이메일 등록
현재 코드에서는 `kwangjin.owl@gmail.com`만 허용합니다.
나중에 다른 이메일을 추가하려면:
- `src/components/LoginPage.tsx` 수정
- `src/App.tsx` 수정
- `ADMIN_EMAIL` 대신 배열로 변경하기
