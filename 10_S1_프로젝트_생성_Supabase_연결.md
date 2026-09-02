# D32 S1 - 프로젝트 생성 + Supabase 연결 (10:00-10:50)

## 지난 시간 복습
### 지금까지의 흐름
D31까지 service blueprint와 User Journey Map을 그렸습니다. 오늘부터 **그 설계를 코드로 만듭니다.** 예약 서비스의 5가지 기능(목록 조회/예약 추가/상태 변경/위치 확인/집계)을 React 컴포넌트로 하나씩 만들고, 마지막에 탭 네비게이션으로 묶어서 허브앱을 완성합니다. S1은 빈 프로젝트를 만들고 Supabase 데이터베이스에 연결하는 세션입니다.

## 오늘의 학습 목표
### 이 세션 주제: Vite 프로젝트 생성 + Supabase bookings 테이블 + 연결 확인
1. Vite로 React + TypeScript 프로젝트를 만들 수 있다
2. Tailwind CSS를 설치하고 스타일이 적용되는지 확인할 수 있다
3. Supabase 대시보드에서 bookings 테이블을 만들 수 있다
4. .env 파일에 Supabase 키를 복사하고 연결이 되는지 확인할 수 있다

이 세션이 끝나면 **브라우저에 "Supabase 연결 성공"이 뜨고 콘솔에 빈 배열 `[]`이 찍혀야** S2로 넘어갑니다.

### 도구 위치 확인 (첫 2분)
오늘 쓰는 도구 네 개 위치만 확인합니다.
**터미널 한 개.** Cursor 하단 터미널 또는 VS Code 터미널. `node -v` 입력해서 버전 숫자가 나오면 정상.
**브라우저 한 개.** 새 탭 열 수 있는 상태. Supabase 대시보드와 localhost 확인에 씁니다.
**Supabase 대시보드.** `supabase.com` 로그인 상태. 프로젝트 목록이 보이면 정상.
**Cursor (또는 VS Code).** 파일 탐색기가 보이는 상태.
네 개 다 확인되면 S1 본 진행 시작.

---

# Part A. React 프로젝트 생성

## 1. Vite + React + TypeScript 프로젝트 만들기

### 1.1 핵심
Vite는 React 프로젝트를 만들어주는 도구입니다. `npm create vite`를 한 번 실행하면 프로젝트 폴더가 생기고 그 안에 React 코드가 들어 있습니다. 오늘 만드는 프로젝트 이름은 `booking-hub`입니다.

### 1.2 처음이면
터미널에서 본인 작업 폴더로 이동한 상태에서 아래 명령을 실행합니다.

[프롬프트]
터미널에 아래를 복사해서 실행하세요.
```bash
npm create vite@latest booking-hub -- --template react-ts
cd booking-hub
npm install
npm run dev
```
실행하면 `Local: http://localhost:5173` 주소가 나옵니다. 브라우저에서 그 주소를 열면 Vite + React 로고가 보입니다.
[프롬프트 끝]

브라우저에 로고가 보이면 프로젝트 생성 성공입니다. 터미널에서 `Ctrl+C`로 서버를 끄고 다음 단계로 넘어갑니다.

### 1.3 기억나면
Vite 프로젝트를 만들어본 적 있으면 `npm create vite@latest booking-hub -- --template react-ts` 실행 후 바로 Tailwind 설치로 건너뜁니다.

**완료 기준**: `booking-hub` 폴더가 생기고, `npm run dev`로 브라우저에 Vite 로고가 뜬다.

### 1.4 안 되면
증상 1: `npm: command not found`
1. Node.js가 설치 안 된 상태. D26에서 설치했는데 터미널을 새로 열지 않았을 수 있음.
2. 터미널 닫고 새로 열어서 `node -v` 확인.
3. 버전 숫자 안 나오면 강사 호명.

증상 2: `localhost:5173`에 접속이 안 됩니다
1. 터미널에 `Local: http://localhost:5173`이 찍혀 있는지 확인. 포트 번호가 5174일 수 있음.
2. 터미널에 에러 메시지가 있으면 `Ctrl+C`로 끄고 `npm run dev` 다시 실행.
3. 그래도 안 되면 `rm -rf node_modules && npm install && npm run dev`.

---

## 2. Tailwind CSS 설치

### 2.1 핵심
Tailwind는 CSS를 클래스 이름으로 쓰는 도구입니다. `bg-blue-500`이라고 쓰면 파란 배경이 됩니다. 별도 CSS 파일을 안 만들어도 됩니다.

### 2.2 처음이면
서버를 `Ctrl+C`로 끈 상태에서 Cursor에 아래 프롬프트를 붙여넣습니다.

[프롬프트]
booking-hub 프로젝트에 Tailwind CSS v4를 설치해줘.
- npm install로 tailwindcss @tailwindcss/vite 설치
- vite.config.ts에 tailwindcss 플러그인 추가
- src/index.css 맨 위에 @import "tailwindcss" 추가
- App.tsx의 내용을 지우고 아래 한 줄로 교체:
  <h1 className="text-3xl font-bold text-blue-600">연결 테스트</h1>
[프롬프트 끝]

`npm run dev`로 서버를 다시 켜고 브라우저를 새로고침합니다. 파란 큰 글자로 "연결 테스트"가 보이면 Tailwind 설치 성공.

**완료 기준**: 브라우저에 파란 큰 글자 "연결 테스트"가 보인다.

### 2.3 안 되면
증상 1: 글자는 보이는데 파란색이 아니고 기본 검정입니다
1. Tailwind가 로드 안 된 상태. `src/index.css` 맨 위에 `@import "tailwindcss"` 있는지 확인.
2. `vite.config.ts`에 tailwindcss 플러그인이 추가됐는지 확인.
3. 서버 `Ctrl+C`로 끄고 `npm run dev`로 재시작.

---

# Part B. Supabase 테이블 만들기 + 연결

## 1. bookings 테이블 생성

### 1.1 핵심
Supabase는 데이터베이스 + API를 제공하는 서비스입니다. 브라우저 대시보드에서 테이블을 만들면 코드에서 바로 읽고 쓸 수 있습니다. 오늘 만들 테이블은 `bookings` - 예약 데이터가 들어갈 곳입니다.

### 1.2 처음이면
Supabase 대시보드(`supabase.com`)에 로그인하고 프로젝트를 클릭합니다. 왼쪽 메뉴에서 **Table Editor** 클릭. 오른쪽 상단 **New Table** 버튼 클릭.

테이블 이름: `bookings`

칼럼을 아래처럼 만듭니다. **id는 자동으로 있습니다.** 나머지를 하나씩 추가합니다.

| 칼럼 이름 | 타입 | 기본값 |
|---|---|---|
| customer | text | (없음) |
| service | text | (없음) |
| date | text | (없음) |
| time | text | (없음) |
| address | text | (없음) |
| status | text | 'pending' |
| via | text | 'form' |
| created_at | timestamptz | now() |

각 칼럼을 추가할 때 **Create new column** 버튼을 누르고, 이름 입력, 타입 선택, 기본값 입력을 반복합니다.

다 만들었으면 **Save** 클릭.

### 1.3 기억나면
Supabase 테이블을 만들어본 분은 위 칼럼 8개만 맞추면 됩니다. `via` 칼럼이 중요합니다 - 나중에 폼으로 잡은 예약(`form`)과 에이전트로 잡은 예약(`agent`)이 같은 테이블에 섞이는 증거가 됩니다.

**완료 기준**: Table Editor에서 `bookings` 테이블 클릭하면 빈 행과 칼럼 9개(id 포함)가 보인다.

### 1.4 안 되면
증상 1: 프로젝트가 없습니다 (빈 대시보드)
1. `New Project` 버튼 클릭해서 프로젝트 하나 만듭니다.
2. 이름은 `booking-hub`, 리전은 `Northeast Asia (Seoul)` 권장.
3. 비밀번호 입력 칸에 임의 비밀번호 입력하고 기억해둡니다 (직접 접속할 때 필요, 코드에서는 안 씀).
4. 2-3분 기다리면 프로젝트가 생성됩니다.

증상 2: 칼럼 타입 선택에서 text가 안 보입니다
1. 타입 드롭다운에서 `text`를 직접 타이핑하면 검색됩니다.
2. `varchar`도 동일하게 작동합니다.

---

## 2. .env 키 복사 + 연결 확인

### 2.1 핵심
Supabase 대시보드 Settings > API에서 두 개의 값을 복사합니다. **Project URL**과 **anon public** 키. 이 두 값을 `.env` 파일에 넣으면 코드에서 Supabase에 접근할 수 있습니다.

### 2.2 처음이면
Supabase 대시보드 왼쪽 메뉴에서 톱니바퀴(**Settings**) 클릭 -> **API** 섹션.

**반드시 따라야 하는 순서:**
1. **Project URL** 옆 복사 버튼 클릭 -> 메모장에 붙여넣기
2. **Project API keys** 섹션에서 `anon` `public` 옆 복사 버튼 클릭 -> 메모장에 붙여넣기

프로젝트 최상위에 `.env` 파일을 만듭니다.

[프롬프트]
booking-hub 프로젝트 최상위에 .env 파일을 만들어줘. 내용:
```
VITE_SUPABASE_URL=여기에_Project_URL_붙여넣기
VITE_SUPABASE_ANON_KEY=여기에_anon_key_붙여넣기
```
그리고 src/lib/supabase.ts 파일을 만들어줘:
- @supabase/supabase-js에서 createClient 가져오기
- import.meta.env에서 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 읽기
- createClient로 supabase 인스턴스 만들어서 export
[프롬프트 끝]

`.env` 파일을 열고 `여기에_` 부분을 아까 메모장에 복사한 실제 값으로 교체합니다.

supabase-js 패키지를 설치합니다.
```bash
npm install @supabase/supabase-js
```

연결을 확인합니다. Cursor에 아래 프롬프트를 붙여넣습니다.

[프롬프트]
App.tsx에서 supabase 연결을 테스트해줘.
- src/lib/supabase.ts에서 supabase를 import
- useEffect에서 supabase.from('bookings').select('*') 실행
- 결과를 console.log로 출력
- 화면에는 "Supabase 연결 성공" 또는 에러 메시지 표시
[프롬프트 끝]

`npm run dev`로 서버 켜고 브라우저에서 확인합니다. 콘솔(`F12` -> Console 탭)에 빈 배열 `[]`이 찍히면 연결 성공.

**완료 기준**: 브라우저 화면에 "Supabase 연결 성공"이 뜨고, 콘솔에 `[]` (빈 배열)이 찍힌다.

### 2.3 안 되면
증상 1: 콘솔에 `401 Unauthorized` 에러
1. `.env` 파일의 키가 정확한지 확인. 앞뒤 공백이 없어야 합니다.
2. `VITE_` 접두어가 빠지면 Vite가 환경변수를 읽지 못합니다. `VITE_SUPABASE_URL`이 맞는지 확인.
3. 서버 `Ctrl+C`로 끄고 `npm run dev`로 재시작 (환경변수 변경은 서버 재시작이 필요).

증상 2: 콘솔에 아무것도 안 찍힙니다
1. `F12` -> Console 탭이 맞는지 확인.
2. `supabase.ts`에서 URL과 KEY가 `undefined`가 아닌지 확인: `console.log(import.meta.env.VITE_SUPABASE_URL)` 추가해서 확인.
3. `.env` 파일이 프로젝트 최상위(`package.json`과 같은 위치)에 있는지 확인.

증상 3: `Module not found: @supabase/supabase-js`
1. `npm install @supabase/supabase-js` 실행이 안 된 상태.
2. 터미널에서 현재 폴더가 `booking-hub`인지 확인 (`pwd`로 확인).

---

# Part C. 오늘 세션 정리

## 이 세션에서 만든 것
- Vite + React + TypeScript 프로젝트 `booking-hub`
- Tailwind CSS 연결 (클래스 이름으로 스타일링)
- Supabase `bookings` 테이블 (칼럼 9개)
- `.env`에 Supabase 키 연결 확인

## 완료 체크리스트
- [ ] `npm run dev`로 브라우저에 앱이 뜬다
- [ ] Tailwind 클래스(`text-blue-600` 등)가 적용된다
- [ ] Supabase 대시보드에 `bookings` 테이블이 보인다
- [ ] 브라우저 콘솔에 빈 배열 `[]`이 찍힌다

## 다음 세션으로
S2에서는 이 연결 위에 첫 번째 기능 두 개를 올립니다. **예약 목록 조회**(테이블에 있는 데이터를 화면에 표로 보여주기)와 **예약 추가**(폼에 입력하면 테이블에 행이 추가되기). 지금 빈 배열이 S2 끝나면 실제 예약 데이터로 채워집니다.
