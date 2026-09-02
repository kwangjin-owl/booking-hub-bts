# 막혔을 때 - 증상별 대응 (AI 가 읽는다)

> 회차마다 다시 쓰지 않는다. 새 증상이 관측되면 **이 파일에 한 줄 추가**한다.
> 출처 = D18-D27 캡처 431장 판독(260827) + D29-D31 실측 + 5기 회차별 대응표.

## 먼저 - 무엇이 잘못됐는지 묻지 않는다

실습자에게는 **몇 번에서 멈췄는지**만 묻는다. 그 단계만 다시 한다. 처음부터 다시 하지 않는다.
같은 단계를 두 번 다시 해도 안 되면 강사를 부른다 - 세 번째는 실습자 시간을 태운다.

---

## A. 파이썬 환경 (가상환경·설치)

| 화면에 뜬 것 | 무엇인가 | 어떻게 |
|---|---|---|
| `command not found: python` | macOS 는 `python3` 다 | `python3` 또는 상자 안 경로 |
| `command not found: pip` | macOS 에 `pip` 가 없다 | `python -m pip` 형태로만 쓴다 |
| `command not found: source:` | 콜론까지 붙여넣었다 | 그 줄만 다시 친다 |
| `no such file: venv/bin/activate` | 점이 빠졌거나 상자가 없다 | `VENV_DIR` 이름으로 다시 만든다 |
| `ModuleNotFoundError` | 설치한 파이썬과 실행하는 파이썬이 다르다 | 상자 안 경로로 실행 |
| `externally-managed-environment` | 상자 밖에 설치하려 했다 | `--break-system-packages` 를 쓰지 말고 3번부터 다시 |
| `... is not on PATH` | 상자 밖 사용자 영역에 설치됐다 | 상자 안 경로로 다시 설치 |
| `Failed building wheel for cryptography` | pip 가 낡았다 | 3번(pip 올리기)을 하고 4번을 다시 |
| `NotOpenSSLWarning ... LibreSSL` | 경고다. 멈추지 않는다 | 그대로 진행 |
| `SyntaxError: invalid syntax` | 파일에 마크다운 표시가 남았다 | 그 줄을 지운다 |
| `[Errno 2] ... app.pysource` | 명령 두 줄이 붙었다 | 한 줄씩 다시 |
| 설치가 빨간 글씨로 죽는다 | 파이썬이 3.13/3.14 라 휠이 없다 | 3.11 또는 3.12 로 `.venv` 를 다시 만든다. 회사 노트북이면 프록시 - 강사 호출 |
| `WindowsApps\python3.exe` 가 잡힌다 | Microsoft Store 스텁이다. 파이썬이 아니다 | `python` 을 쓴다 |
| 프롬프트에 `(base)` | conda 환경이다 | 그대로 두고 별도 가상환경을 만든다 |

## B. 열쇠 (.env)

| 증상 | 무엇인가 | 어떻게 |
|---|---|---|
| `키 없음` | `.env` 가 없거나 값이 비었다 | `.env.example` 이 아니라 `.env` 인지 본다. 이름을 바꾸지 않는다 |
| `API key not valid` | 앞뒤 빈칸 또는 따옴표가 들어갔다 | `=` 앞뒤 빈칸 없이 다시 붙여 넣는다 |
| 변수 이름을 바꿨다 | 이름 오타로 20분을 잃은 사례가 있다 | `_env.yaml` 의 `required_keys` 이름 그대로 쓴다 |
| 남의 키가 들어 있다 | 다른 실습자 폴더를 복사했다 | 지우고 실습자에게 알린다. 그 키는 쓰지 않는다 |

## C. 실행한 뒤

| 증상 | 무엇인가 | 어떻게 |
|---|---|---|
| 웹은 뜨는데 응답이 없다 | 터미널 빨간 줄을 본다 | 마지막 3줄을 강사에게 보인다 |
| 기억이 안 이어진다 (턴2 가 백지) | 탭이 다르면 대화 묶음이 달라진다 | 같은 창에서 친다. 응답 머리글의 여덟 글자가 같은지 본다 |
| 주소가 이미 쓰이고 있다 | 앞 실행이 안 꺼졌다 | 포트를 바꿔 다시 띄우고 새 주소를 알린다 |
| 화면이 안 바뀐다 | 설정 파일을 고쳤다 | `Ctrl + C` 로 끄고 다시 켠다 |

## D. 웹 배포 (Vercel·Supabase)

| 증상 | 무엇인가 | 어떻게 |
|---|---|---|
| 배포 주소에서 Vercel 로그인 화면 | 긴 주소는 보호가 걸려 있다 | `npx vercel ls` 의 **짧은 주소**를 쓴다. 그래도 뜨면 Settings -> Deployment Protection -> Disabled |
| `저장에 실패했어요` | 표에 정책(RLS)이 없다 | `pipa/rls_내것만.sql` 의 policy 문을 SQL Editor 에서 Run |
| 같은 증상인데 정책은 있다 | 배포 환경변수가 없다 | 배포 주소 뒤 `/api/config` 를 열어본다. 없으면 Vercel Settings -> Environment Variables |
| `표 없음` | SQL 을 아직 Run 하지 않았다 | `_table.sql` 을 통째로 붙여넣고 Run |
| `npx vercel` 이 로그인을 요구 | 첫 배포다 | `npx vercel login` -> 실습자 본인 구글 계정 |
| Windows 에서 `npx` 가 안 먹힌다 | 확장자가 필요하다 | `npx.cmd`. 그래도 안 되면 `node -v` 로 설치부터 |
| 폰에서 안 열린다 | 주소를 손으로 옮겨 적다 틀린다 | 카카오톡 "나에게 보내기" 로 링크를 보낸다 |
| 두 계정으로 봤더니 남의 글이 보인다 | select 정책이 없거나 넓다 | `pipa/rls_내것만.sql` 의 select 정책을 다시 본다. **배포 중단 사유다** |

## D2. GitHub 에 올릴 때

| 증상 | 무엇인가 | 어떻게 |
|---|---|---|
| `gh: command not found` | GitHub CLI 가 없다 | 웹에서 만든다. github.com 우상단 `+` -> `New repository` -> 화면의 `git remote add origin ...` 두 줄 실행 |
| `Permission denied (publickey)` | SSH 열쇠가 없다 | `gh auth login` 또는 주소를 `https://` 로 바꾼다 |
| `remote origin already exists` | 이미 연결돼 있다 | `git remote set-url origin <새 주소>` |
| `nothing to commit` | 스테이징을 안 했다 | 커밋 전 단계를 다시 |
| `.env` 가 올라갔다 | `.gitignore` 에 없었다 | **키를 새로 발급한다.** 저장소에서 지워도 이력에 남는다. 강사 호출 |
| `failed to push some refs` | 원격에 다른 커밋이 있다 | `git pull --rebase` 후 다시 push |
| 남의 저장소에 올렸다 | remote 주소가 강사·동료 것이다 | `git remote -v` 로 확인하고 자기 계정 주소로 바꾼다 |

## D3. Supabase

| 증상 | 무엇인가 | 어떻게 |
|---|---|---|
| `Success. No rows returned` 가 안 뜬다 | SQL 이 중간에 끊겼다 | `_table.sql` 을 통째로 다시 붙여넣는다 |
| `relation ... already exists` | 표가 이미 있다 | 그대로 진행한다. 정책 문만 따로 Run |
| 저장은 되는데 목록이 비었다 | select 정책이 없다 | 잠금(RLS)을 켜면 정책마다 따로 필요하다 |
| 브라우저 콘솔에 `service_role` 이 보인다 | 비밀 키가 화면 쪽에 들어갔다 | **즉시 멈춘다.** 키를 새로 발급하고 서버 쪽으로 옮긴다. 강사 호출 |
| 프로젝트 주소가 안 열린다 | 무료 프로젝트가 일시정지됐다 | 대시보드에서 `Restore` |

## E. 한도 `429` - 세 종류다

- `limit: 15` - 1분에 15번을 넘겼다. 한도는 **모델마다 따로**다. 다른 모델로 바꾸면 그 자리에서 계속된다
- `limit: 500` - 하루치를 다 썼다. 날이 바뀌어야 풀린다
- 상태 `제한됨` - 프로젝트가 잠겼다. 강사에게 알린다

VS Code 의 Continue 확장이 실습과 **같은 모델**을 쓰면 서로 잡아먹는다. 자주 나면 Continue 쪽 모델을 바꾼다.

## F. Windows 전용

| 증상 | 어떻게 |
|---|---|
| 한글이 `Ű OK  ���� 53` 로 깨진다 | 파이썬 파일 위의 `sys.platform == "win32"` 두 줄을 지우지 않는다 |
| `Set-ExecutionPolicy` 를 매번 친다 | `activate` 를 쓰지 않는다. `.\.venv\Scripts\python.exe` 경로로 직접 실행 |
| `py` 가 없다 | `python` 을 쓴다 |
| 가상환경 경로 | `.\.venv\Scripts\python.exe`. 맥 경로(`./.venv/bin/python`)를 쓰면 260825 사고가 재발한다 |

## G. VS Code / Continue 확장

| 증상 | 어떻게 |
|---|---|
| `Continue (config error)` | 설정 파일에 문서가 두 개 붙었다. 위쪽 한 벌만 남긴다. **덮어쓰기**로 붙인다 |
| `No models configured` | 설정의 apiKey 가 비었다. 값을 채우거나 그 모델 블록을 지운다 |
| 인터프리터가 안 잡힌다 | Python 확장 설치 권장 팝업이 뜨면 설치한다 |

## H. 폴더·압축

| 증상 | 어떻게 |
|---|---|
| 폴더 이름이 `이름 2`, `이름 3`, `이름-now` | 압축을 여러 번 풀었다. 가장 최근 것 하나만 쓰고 나머지는 지운다 |
| 파일 하나만 열렸다 | 폴더를 안 열었다. File > Open Folder 를 다시 |
| `ENTRY` 파일이 안 보인다 | 하위 폴더를 한 단계 찾아본다 |
| 왼쪽 목록에 같은 이름 폴더가 또 있다 | 두 겹이다. 안쪽 폴더를 연다 |
| 점으로 시작하는 파일이 안 보인다 | 탐색기·Finder 가 숨긴다. **VS Code 왼쪽 목록에는 보인다.** 거기서 본다. Finder 에서 보려면 `Cmd + Shift + .` |
| 한글 파일명이 `¿½¿½` 처럼 깨졌다 | 압축이 UTF-8 플래그 없이 만들어졌다. 강사에게 다시 받는다 (`make_zip.py` 로 만든 것을 받아야 한다) |
| 설치가 엉뚱한 오류로 멈춘다 | 경로에 한글이 있는지 본다 - 폴더 이름 / Windows 사용자 계정 이름 / 컴퓨터 이름 셋. 뒤 둘은 강사를 부른다 |
| 다운로드 폴더에서 풀었다 | `dev` 폴더로 옮기고 VS Code 를 다시 연다. 옮긴 뒤에는 터미널도 새로 연다 |

## I. 강사를 부르는 기준

아래는 실습자·AI 가 풀지 않는다. 바로 부른다.

- 같은 단계를 두 번 다시 해도 같은 증상
- 파이썬·Node 가 기계에 아예 없다
- 회사 노트북 프록시·보안 프로그램이 설치를 막는다
- API 프로젝트 상태가 `제한됨`
- 두 계정 검증에서 남의 데이터가 보인다 (개인정보 사고. 배포를 멈춘다)
- 실습자가 자기 것이 아닌 이메일·연락처를 넣었다
