# 예약 관리 허브

구글 계정으로 로그인해 예약을 등록하고, 관리자가 확정하면 구글 캘린더에 일정이 자동으로 만들어지는 웹앱입니다.

**배포 주소** — https://booking-hub-bts.vercel.app

---

## 주요 기능

**예약 등록** — 고객사, 서비스, 날짜·시간, 주소를 입력해 등록합니다. 주소는 지도에서 검색하거나 핀을 끌어 지정하고, 층·호수는 따로 적습니다. 같은 날 비슷한 시간에 다른 예약이 있으면 미리 알려줍니다.

**예약 관리** — 검색·상태 필터·정렬로 예약을 찾습니다. 목록 보기와 월별 캘린더 보기를 오갈 수 있고, 주소를 누르면 지도가 열립니다.

**구글 캘린더 연동** — 관리자가 확정하면 구글 캘린더에 일정이 생깁니다. 대기로 되돌리거나 예약을 지우면 일정도 함께 사라지고, 수정하면 일정도 갱신됩니다.

**날씨** — 대시보드에서 가장 가까운 예약 5건의 날짜·장소 날씨를 보여줍니다. 강수 확률이 높으면 따로 표시됩니다.

**권한 분리** — 구글 계정이면 누구나 로그인해 예약할 수 있지만, 자기가 등록한 예약만 보입니다. 확정·수정·삭제는 관리자만 할 수 있습니다.

---

## 기술 스택

| 분류 | 사용 기술 |
|---|---|
| 프론트엔드 | React 19, TypeScript, Vite 8 |
| 스타일 | Tailwind CSS v4 |
| 백엔드 | Supabase (PostgreSQL + 구글 OAuth) |
| 지도 | Leaflet, OpenStreetMap, Nominatim |
| 날씨 | Open-Meteo |
| 배포 | Vercel (정적 호스팅 + 서버리스 함수) |

---

## 로컬에서 실행하기

### 준비물

- Node.js 20 이상 (Vite 8이 요구합니다)
- Supabase 프로젝트
- 구글 OAuth 클라이언트

### 설치

```bash
npm install
```

### 환경변수

루트에 `.env` 파일을 만들고 아래 값을 채웁니다. `.env.example`을 복사해서 쓰면 됩니다.

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

구글 캘린더 연동까지 로컬에서 확인하려면 세 줄을 더 넣습니다. **`VITE_` 접두사를 붙이면 안 됩니다.** 붙이면 브라우저 번들에 시크릿이 그대로 실립니다.

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=1//...
```

### 데이터베이스

Supabase SQL Editor에서 `db/` 폴더의 SQL을 순서대로 실행합니다.

1. 테이블 생성
2. 권한(RLS) 정책
3. 상세주소 컬럼
4. 중복 확인 함수

### 실행

```bash
npm run dev
```

http://localhost:5173 에서 열립니다.

**단, 이 방식으로는 구글 캘린더 연동이 동작하지 않습니다.** `/api/calendar`는 Vercel 서버리스 함수라 Vite 개발 서버에는 없기 때문입니다. 연동까지 확인하려면 아래 명령을 씁니다.

```bash
npx vercel dev
```

---

## 배포

`main` 브랜치에 푸시하면 Vercel이 자동으로 빌드하고 배포합니다.

환경변수 5개는 Vercel 대시보드(Settings → Environment Variables)에 등록해야 합니다.

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
```

이름의 대소문자가 정확해야 합니다. 그리고 환경변수는 빌드 시점에 주입되므로, 값을 바꾼 뒤에는 **반드시 재배포**해야 반영됩니다.

---

## 폴더 구조

```
api/                     Vercel 서버리스 함수
  calendar.js            구글 캘린더 생성·삭제 (관리자 인증 포함)
db/                      Supabase SQL
public/                  정적 파일
src/
  App.tsx                탭 구성, 세션 관리, 권한 분기
  supabaseClient.ts      Supabase 클라이언트
  lib/                   순수 로직 (권한 판별, 주소 변환, API 호출)
  components/            화면 조각
```

---

## 참고

프로젝트 배경, 해결한 문제들, 앞으로 할 일은 `예약 관리 허브_인수인계.md`에 정리돼 있습니다.
