# Admin self-hosted runner runbook

통합매니저(Admin) 테스트는 GitHub Hosted Runner IP/VPN 제약 때문에 로컬 Mac self-hosted runner에서만 실행한다.

## Runner requirements

- GitHub repository: `dykim0518/makestar-e2e-tests`
- Runner labels: `self-hosted`, `macOS`, `admin-local`
- Node.js는 workflow에서 `actions/setup-node`로 설치한다.
- 로컬 Mac은 사내 VPN 또는 Admin 접근 가능한 네트워크에 연결되어 있어야 한다.

## GitHub setup

1. GitHub repository Settings > Actions > Runners에서 macOS self-hosted runner를 추가한다.
2. Runner 설정 단계에서 custom label `admin-local`을 추가한다.
3. Runner를 백그라운드 서비스로 등록한다.

## Required secrets and variables

필수:

- `DASHBOARD_URL`: QA Hub URL
- `DASHBOARD_API_SECRET`: QA Hub API 인증 토큰

Admin 인증은 아래 중 하나가 필요하다.

- `AUTH_JSON` 또는 `STG_AUTH_JSON` GitHub Actions secret
- 또는 repository variable `ADMIN_AUTH_STATE_PATH`

`ADMIN_AUTH_STATE_PATH`는 self-hosted runner가 읽을 수 있는 로컬 인증 파일 경로다. 예:

```text
/Users/makestar_edkim/Projects/my-playwright-tests/auth.json
```

workflow는 secret을 우선 사용하고, secret이 없으면 `ADMIN_AUTH_STATE_PATH`의 파일을 runner workspace의 `auth.json`으로 복사한다.

## Dashboard trigger flow

1. QA Hub `/trigger`에서 suite `통합매니저`를 선택한다.
2. QA Hub가 기존처럼 `playwright.yml` workflow dispatch를 호출한다.
3. `suite=admin` 또는 `project`에 `admin`이 포함된 요청은 Ubuntu job을 건너뛰고 `admin-local` job으로 라우팅된다.
4. `admin-local` job은 `playwright.ci.config.js`의 `admin-gate` project를 실행한다.
5. `lib/live-reporter.js`와 final results push가 QA Hub에 실행 상태와 결과를 전송한다.

## Smoke check

로컬 runner 등록 후 GitHub Actions에서 수동 실행:

```text
suite: admin
environment: prod
project:
spec:
grep:
retries: 0
```

기대 결과:

- `Playwright Monitoring` job은 skipped
- `Playwright Admin Local` job은 self-hosted runner에서 실행
- QA Hub `/trigger` 결과 패널에 running/test-end/end 이벤트가 표시
