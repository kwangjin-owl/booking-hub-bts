# booking-hub - Day 32 뼈대 프로젝트

**`00_START_HERE.md` 부터 읽습니다.**

이 폴더를 `dev` 폴더 안에 두고 VS Code로 연 다음, AI 채팅창에 **"실행해줘"** 라고 씁니다. 나머지는 AI가 합니다.

## 이미 들어 있는 것

| 무엇 | 상태 |
|---|---|
| Vite + React + TypeScript | 잡혀 있음 |
| Tailwind CSS v4 | 잡혀 있음. `src/index.css` 한 줄 |
| Supabase 클라이언트 | 설치됨. 연결은 S1에서 합니다 |
| `src/App.tsx` | 파란 글자 "연결 테스트" 한 줄 |

프로젝트 생성과 Tailwind 설치는 이 뼈대가 대신합니다. 나중에 자기 프로젝트를 처음부터 만들 때 쓰는 프롬프트는 S1 가이드의 프롬프트 1-2에 그대로 있습니다.

## 파일 안내

| 파일 | 언제 |
|---|---|
| `00_START_HERE.md` | 맨 먼저 |
| `10_S1` ~ `40_S4` | 각 세션 시작할 때. 프롬프트가 여기 있습니다 |
| `AGENTS.md` | AI가 읽습니다 |
| `명령어.md` | 터미널을 직접 쓸 때 |
| `_table.sql` | S1에서 Supabase SQL Editor에 붙여넣습니다 |
| `.env.example` | S1에서 `.env` 를 만들 때 본을 뜹니다 |
| `check.mjs` | `node check.mjs` - 키와 표 확인 |
| `_troubleshoot.md` | 막혔을 때 |
| `_env.yaml` | 이 회차의 값. 고치지 않습니다 |

## 손대지 않는 것

`.env` 는 절대 커밋하지 않습니다. `.gitignore` 에 이미 막아 두었고 그 줄을 지우지 않습니다.
