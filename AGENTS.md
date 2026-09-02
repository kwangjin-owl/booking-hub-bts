# 이 폴더에서 AI 가 할 일

실습자는 폴더를 열고 **"실행해줘"** 한 마디만 한다. 아래를 AI 가 대신 한다.
안내 문서가 여러 개면 실습자에게 읽으라 하지 말고 AI 가 읽는다.

**이 회차에 필요한 값은 전부 `_env.yaml` 에 있다.** 아래 대문자 이름은 그 파일에서 읽는다.
`_env.yaml` 이 없으면 실습자에게 알리고 멈춘다.

**`_env.yaml` 의 `kind` 가 갈림길이다.** `python` 이면 3-5 절을, `web` 이면 3W 절을 한다.
그 외 절은 값이 있을 때만 한다 - `sql_file` 이 없으면 7절을, `repo` 가 없으면 10절을,
`deploy` 가 없으면 11-12절을 건너뛴다.

## 규칙 0-0 - 실습자 손이 필요한 것은 다섯뿐이다

**아래 다섯 말고는 전부 AI 가 한다.** 실습자에게 명령을 치게 하거나 파일을 채우게 하지 않는다.
설치, 코드 작성, 커밋, 배포, 설정 파일, 디자인 파일은 전부 AI 몫이다.

1. **로그인** - 구글·GitHub 계정 로그인. 비밀번호는 실습자만 칠 수 있다
2. **키 복사** - Supabase, 구글 콘솔 등 실습자 계정 화면에서 값을 복사해 `.env` 에 붙여넣기
3. **대시보드 클릭** - SQL Editor 에 붙여넣고 Run, 콘솔에서 API 켜기 같은 실습자 계정 화면 조작
4. **한 번 고르기** - AI 가 물을 때 답하기(색 / 서비스 이름 / 만들 화면 한 줄)
5. **폰으로 열어보기** - 통과 판정

이 다섯을 요청할 때는 **한 번에 한 줄만** 말한다.
"supabase.com 에서 Settings -> API 를 열고 값을 복사해 주세요" 처럼 어디서 무엇을 할지 한 문장.

실습자가 "이거 어떻게 해요" 라고 물으면 그 일을 AI 가 대신 할 수 있는지 먼저 본다.
할 수 있으면 그냥 한다. 위 다섯에 해당할 때만 요청한다.

## 규칙 0 - 실패를 성공이라 말하지 않는다

명령을 돌린 뒤 **종료 코드와 출력을 먼저 본다.** `command not found` / 0 아닌 exit code /
`Traceback` / `ImportError` / `No such file` / `Error` / `Failed` 중 하나라도 있으면 **실패다.**
그 상태에서 "성공적으로 실행되었습니다" 라고 쓰지 않는다. 무엇이 실패했는지 한 줄로 말하고 멈춘다.

**주소를 실습자에게 알리기 전에 그 주소를 실제로 한 번 연다.** 200 이 아니면 실패다.

## 규칙 0-1 - 코드에 마크다운 표시를 남기지 않는다

파일을 쓸 때 백틱 세 개나 ` ```python ` 같은 표시를 코드 안에 남기지 않는다.
남기면 `SyntaxError: invalid syntax` 가 난다. 파일을 쓴 뒤 첫 줄과 끝 줄을 눈으로 확인한다.

## 규칙 0-2 - 이건 실습자 대신 하지 않는다

계정 만들기 / 비밀번호 입력 / 결제 정보 입력. 실습자가 직접 한다.
키 값을 화면에 출력하지 않는다 - 길이만 찍는다(`키 OK  길이 39`).
`.env` 는 읽지도 쓰지도 **커밋하지도** 않는다. `.env.example` 만 다룬다.
남의 키가 폴더에 들어 있으면 지우고 실습자에게 알린다.

## 규칙 0-3 - 로그인을 받는 회차면

`_env.yaml` 의 `login` 이 `true` 면 같은 폴더의 `pipa/` 를 먼저 읽는다.
만들지 않는 것(주민번호·연락처·결제·신분증)과 빠뜨리지 않는 것(RLS·처리방침·동의·삭제 버튼)이 거기 있다.

## 1. 지금 이 기계가 어떤 상태인지 먼저 본다

묻지 말고 확인한다.

- **운영체제** - Windows 인가 macOS 인가. 아래 명령은 확인한 쪽만 쓴다
- **폴더** - `ENTRY` 파일이 보이는가. 없으면 하위 폴더를 한 단계 찾는다
- **폴더 이름이 `이름 2`, `이름 3`, `이름-now` 로 끝나면** 압축을 여러 번 푼 것이다.
  실습자에게 알리고 가장 최근 것 하나만 쓴다
- **지금 경로가 어디인가** - `pwd`(macOS) / `cd`(Windows). 아래 셋 중 하나면 먼저 옮긴다.
  옮긴 뒤 VS Code 를 그 폴더로 다시 열게 하고 터미널도 새로 연다
  - 다운로드 폴더 안 - 압축이 덜 풀린 상태로 도는 경우가 있다
  - 경로에 한글이 있다 - 설치가 엉뚱한 오류로 멈춘다
  - 경로에 빈칸이 있다 - 명령이 두 조각으로 갈린다

  갈 곳은 `dev` 폴더다. Windows `C:\dev`, macOS `~/dev`. 없으면 만든다
- **경로 한글 셋** - 폴더 이름은 옮겨서 푼다. 그러나 **Windows 사용자 계정 이름과 컴퓨터 이름이
  한글이면 옮겨도 안 풀린다.** 실습자에게 알리고 강사를 부른다. 대신 고치려 하지 않는다
- `.env` 가 있는가. 없으면 `.env.example` 을 복사해 만든다.
  점으로 시작하는 파일은 탐색기·Finder 가 숨긴다 - 실습자가 "그 파일 없어요" 라고 하면
  없는 것이 아니라 안 보이는 것이다. VS Code 왼쪽 목록에서 같이 확인한다

`kind: python` 이면 추가로:

- **파이썬이 어느 것인지** - 이름이 아니라 실제 경로를 본다.
  macOS `which python3` / Windows `where.exe python`
  - `WindowsApps\python3.exe` = Microsoft Store 스텁이다. 파이썬이 아니다. `python` 을 쓴다
  - `(base)` 프롬프트 = conda 환경이다. 그대로 두고 3절에서 별도 가상환경을 만든다
- **버전** - `PYTHON_MAX` 를 넘으면(대개 3.13/3.14) 오늘 패키지의 휠이 없어 설치가 죽는다.
  3.11 또는 3.12 로 만들게 하고, 없으면 강사를 부른다
- **Python 확장** - 설치 권장 팝업이 뜨면 설치한다. 없으면 인터프리터가 안 잡힌다
- `VENV_DIR` 가 이미 있으면 3절을 건너뛴다

`kind: web` 이면 추가로:

- **Node** - `node -v`. `NODE_MIN` 미만이거나 없으면 실습자에게 알리고 멈춘다
  (설치를 대신 하지 않는다. nodejs.org 에서 LTS 를 받으라고만 알린다)

## 2. 명령을 고를 때

- 명령을 여러 줄 보낼 때 **한 줄씩 보낸다.** 붙으면 `app.pysource` 같은 없는 파일을 찾는다
- Windows 와 macOS 명령을 섞지 않는다. 1절에서 확인한 쪽만 쓴다
- `kind: python` - **`pip` 를 단독으로 치지 않는다.** 항상 `python -m pip` 형태로 쓴다.
  **`activate` 를 쓰지 않는다.** 아래 경로를 매번 그대로 적어 실행한다
  - Windows `.\VENV_DIR\Scripts\python.exe` / macOS `./VENV_DIR/bin/python`
- `kind: web` - `package.json` 이 있으면 3W 절에서 `npm install` 을 한다.
  배포 도구(`vercel`)는 설치하지 않고 `npx` 로 그때그때 쓴다. Windows 에서 막히면 `npx.cmd`

## 3. 상자와 pip (`kind: python`)

없으면 만들고, pip 를 최신으로 올린다. `PYTHON_MIN` 미만이면 이 단계를 반드시 한다.

- Windows `python -m venv VENV_DIR` 그리고 `.\VENV_DIR\Scripts\python.exe -m pip install --upgrade pip`
- macOS `python3 -m venv VENV_DIR` 그리고 `./VENV_DIR/bin/python -m pip install --upgrade pip`

`externally-managed-environment` 가 뜨면 **가상환경 밖에서 설치하려 한 것이다.**
`--break-system-packages` 를 쓰지 말고 위 순서대로 상자를 먼저 만든다.

## 3W. 설치 (`kind: web`)

AI 가 한다. 실습자는 기다린다.

- `package.json` 이 있으면 `npm install`
- `_env.yaml` 에 `design` 이 있으면 `npx shadcn@latest init` 도 한다.
  shadcn 이 물어보는 것(스타일, 색, 경로)은 전부 AI 가 기본값으로 답한다

`package.json` 이 없으면 설치할 것이 없다. 6절로 간다.

## 4. 설치 (`kind: python`)

`requirements.txt` 가 있으면 그것으로, 없으면 `PACKAGES` 목록 그대로 **상자 안 파이썬으로** 설치한다.
부등호나 `==` 버전을 바꾸지 않는다.

- Windows `.\VENV_DIR\Scripts\python.exe -m pip install -r requirements.txt`
- macOS `./VENV_DIR/bin/python -m pip install -r requirements.txt`

1-3분 걸린다. 글자가 올라가는 것은 정상이다.
`WARNING: ... which is not on PATH` 가 뜨면 상자 밖에 설치된 것이다. 2절 경로로 다시 한다.

## 5. 설치 확인 (`kind: python`)

`IMPORT_CHECK` 목록을 **상자 안 파이썬으로** import 해서 통과해야 다음으로 간다.
여기서 `ModuleNotFoundError` 가 나면 설치한 파이썬과 실행하는 파이썬이 다른 것이다. 경로를 맞춘다.

## 6. 열쇠

`.env` 의 값이 비어 있는지 먼저 본다 - 남의 키가 들어 있으면 지우고 실습자에게 알린다.
그 다음 이 한 줄만 요청한다:

"`.env` 를 열어 `REQUIRED_KEYS` 뒤에 본인 값을 붙여 넣고 저장해 주세요."

**변수 이름을 바꾸지 않는다.** 이름 오타로 20분을 잃은 사례가 있다.
`=` 앞뒤에 빈칸을 넣지 않는다. 따옴표도 넣지 않는다.

값을 어디서 가져오는지는 `_env.yaml` 의 `key_source` 를 실습자에게 그대로 읽어준다.
Supabase 면 `내 프로젝트 -> Settings -> API`, Gemini 면 `aistudio.google.com -> Get API key`.

## 7. 표 만들기 (`sql_file` 이 있을 때, Supabase)

`SQL_FILE` 의 내용을 실습자에게 보여주고 이 한 줄만 요청한다:

"supabase.com 에서 내 프로젝트 -> SQL Editor 에 이 내용을 붙여넣고 Run 을 눌러 주세요."

`Success. No rows returned` 를 봤다고 실습자가 말하면 다음으로 간다.

**파일 끝의 policy 문을 빼먹지 않는다.** 표만 만들고 잠금(RLS)을 켜면 저장이 전부 거부된다.
통째로 한 번에 붙여넣게 한다. `login: true` 면 `pipa/rls_내것만.sql` 이 그 정본이다.

**키 두 종류를 구분한다.** `anon` 은 브라우저에 들어가도 되는 공개용이고,
`service_role` 은 서버에만 둔다. 브라우저 코드나 `index.html` 에 `service_role` 을 넣지 않는다.

## 7D. 화면 고르기 (`kind: web`, `design` 이 있을 때)

**블록코딩이다.** Framer 나 FlutterFlow 처럼 완성된 화면 중에서 고르기만 한다.
실습자는 창작자다. 개발자가 아니다. 코드, 설정, 기술 용어는 보여주지 않는다.

### 순서

1. AI 가 실습자 브라우저에서 `https://ui.shadcn.com` 을 연다.
   화면 오른쪽에 `Shuffle` 버튼이 있다. 누를 때마다 색과 분위기가 바뀐다.
2. 실습자에게 한 줄만 말한다:
   **"Shuffle 눌러 보시고 마음에 드는 분위기가 나오면 말씀해 주세요."**
3. 실습자가 정하면 AI 가 화면의 preset 코드를 읽는다.
   실습자에게 코드 이름을 알려주지 않는다. 고른 분위기가 적용된 것만 확인시킨다.
4. AI 가 같은 브라우저에서 `https://ui.shadcn.com/blocks` 를 연다.
   완성된 화면 뼈대가 카테고리별로 나열돼 있다.
5. 실습자에게 한 줄만 말한다:
   **"오늘 만들 화면과 가장 비슷한 것 하나를 골라 주세요."**
6. AI 가 고른 블록을 설치해 화면을 만든다.

### 실습자에게 요청하는 것

이 절에서 실습자가 하는 일은 **두 번 고르기**뿐이다.
색 코드, 폰트 이름, 설치 명령, 컴포넌트 이름은 실습자에게 보여주지 않는다.
서비스 이름이나 설명은 이 절에서 묻지 않는다.

### design.md

AI 전용 기록이다. 실습자는 이 파일을 열지 않는다.

```
preset: b0
block: login-03
picked: 2026-09-02
```

다음 회차에 화면을 고칠 때 AI 가 이 파일을 먼저 읽는다. 색을 새로 정하지 않는다.

## 8. 동작 확인

`CHECK` 를 돌린다. `kind: python` 이면 상자 안 파이썬으로, `web` 이면 `node CHECK`.
`_env.yaml` 의 `check_expect` 에 적힌 줄이 전부 나와야 한다.
안 나오면 그 줄이 가리키는 절로 돌아간다.

## 9. 로컬에서 띄우기

- `kind: python` - `ENTRY` 를 상자 안 파이썬으로 실행한다. 출력에 `EXPECT_URL` 이 든 줄이
  나오면 그 주소를 실습자에게 알린다. 그 위의 경고 줄은 정상이다.
  주소가 이미 쓰이고 있으면 포트를 바꿔 다시 띄우고 새 주소를 알린다. 끄는 것은 `Ctrl + C`
- `kind: web` - `package.json` 에 `dev` 스크립트가 있으면 `npm run dev`.
  없으면 `npx serve . -l PORT`. 주소가 열리면 실습자에게 알린다.
  `npm run dev` 는 파일을 고치면 화면이 자동으로 바뀐다

## 10. GitHub 에 올리기 (`repo` 가 있을 때)

**올리기 전에 `.gitignore` 에 `.env` 가 있는지 확인한다.** 없으면 넣고 시작한다.
이미 `.env` 가 올라간 뒤면 그 자리에서 멈추고 실습자에게 알린다 - 키를 새로 발급해야 한다.

**AI 가 친다.** 실습자에게 명령을 치게 하지 않는다. 한 줄씩 보낸다.

- `git init`
- `git add -A`
- `git commit -m "REPO"`

- `gh repo create REPO --public --source . --push`

`gh auth login` 이 필요하면 그때만 실습자에게 "브라우저에서 GitHub 로그인 해주세요" 한 줄.

`gh: command not found` 면 웹에서 만든다 - github.com 우상단 `+` 에서 `New repository`,
이름은 `REPO`, `Create` 를 누르면 화면에 `git remote add origin ...` 두 줄이 나온다. 그대로 실행한다.

- `Permission denied (publickey)` - `gh auth login` 을 하거나 주소를 `https://` 로 바꾼다
- `remote origin already exists` - `git remote set-url origin <새 주소>`
- `nothing to commit` - 두 번째 줄을 안 했다

**실습자 계정으로 만든다.** 강사 계정이나 다른 실습자 저장소에 올리지 않는다.

## 11. 배포 (`deploy` 가 있을 때, Vercel)

- `npx vercel login`
- `DEPLOY`

처음이면 브라우저 로그인 창이 열린다. "브라우저에서 로그인 해주세요" 한 줄만 알린다.
프로젝트 이름을 물으면 기본값 그대로 엔터.

### 주소가 두 개다 - 짧은 쪽을 알린다

`--prod` 가 출력하는 **긴 주소**(`이름-a1b2c3-계정.vercel.app`)는 보호가 걸려 있어
실습자가 열면 Vercel 로그인 화면이 뜬다. 이걸 알리면 실습이 막힌다.

`npx vercel ls` 로 **짧은 주소**(`이름.vercel.app`)를 찾는다. 그 주소를 열어 200 인지
확인한 뒤 그것만 실습자에게 알린다. 스마트폰 접속도 그 주소로 한다.

짧은 주소도 로그인 화면이 뜨면 이 다섯 단계를 안내한다.
vercel.com 에서 내 프로젝트, `Settings`, `Deployment Protection`,
`Vercel Authentication` 을 `Disabled`, `Save`.

**`Disabled` 로 바꾸는 순간부터 주소를 아는 누구나 들어온다.** `login: true` 인 회차면
`pipa/AGENTS_책임경계.md` 규칙 D 한 줄을 실습자에게 읽어준 뒤에만 주소를 실습방에 올린다.
실습방 밖(개인 SNS·단톡)에는 올리지 않는다.

## 12. 배포 환경변수 (`deploy` 가 있을 때)

**AI 가 넣는다.** 실습자를 대시보드로 보내지 않는다. `.env` 의 각 줄을 이렇게 올린다.

- `printf '%s' "<값>" | npx vercel env add <이름> production`

값은 화면에 찍지 않는다. 다 넣고 `DEPLOY` 를 다시 실행한다.
**환경변수는 재배포해야 반영된다.**

명령이 막히거나 계정 권한이 없을 때만 실습자에게 이 다섯 단계를 요청한다.
vercel.com 접속, 내 프로젝트, `Settings`, `Environment Variables`,
`.env` 의 이름과 값을 그대로 넣고 `Production` 체크 후 `Save`.

확인은 배포 주소 뒤에 `/api/config` 를 붙여 열어본다.

## 13. 통과 판정

`_env.yaml` 의 `pass_check` 에 적힌 것을 하나씩 눈으로 확인한다.
배포한 회차면 **실습자 스마트폰으로** 열어 확인한다. 하나라도 안 되면 `_troubleshoot.md` 를
읽고 그 단계만 다시 한다.

## 실습자가 막혔을 때

무엇이 잘못됐는지 묻지 말고 **몇 번에서 멈췄는지**만 묻는다. 그 단계만 다시 한다.
증상별 대응은 같은 폴더의 `_troubleshoot.md` 를 읽는다.
같은 단계를 두 번 다시 해도 안 되면 강사를 부른다(갈래 I).

## 손대지 않는 것

강사가 실측으로 고정한 값이다. 실습자가 명시적으로 요청하지 않으면 그대로 둔다.

`_env.yaml` 의 값 전부 / 패키지 **버전**(`gradio==5.14.0`, `langgraph==1.2.11`) /
`sys.platform == "win32"` 로 시작하는 두 줄(지우면 Windows 에서 한글이 깨진다) /
`VENV_DIR` 경로 / `.env` 의 변수 이름 / `api/` 안의 파일.

설명은 한국어로 하고 영어 약어는 처음 나올 때 괄호로 푼다. 이모지와 em dash 를 쓰지 않는다.
