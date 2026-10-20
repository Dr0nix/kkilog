# 앱 배포 (운영자용)

APK 빌드와 OTA 업데이트 방법. 지인에게 보낼 설치 안내는 [install.md](install.md).

- 빌드는 EAS Build(Expo 클라우드), 업데이트는 EAS Update. Expo 계정은 운영자 한 명만 있으면 된다. 지인들은 Expo가 필요 없다.
- 설정 파일: `apps/mobile/app.json`(앱 ID `dev.kkilog.app`, 버전), `apps/mobile/eas.json`(빌드 프로필 `production`)
- 명령은 전부 `apps/mobile`에서 실행한다. PowerShell에서 `npx`가 막히면 `npx.cmd`로 쓴다. `eas-cli`는 의존성으로 넣지 않고 `npx`로 실행한다.

## 처음 한 번
1. https://expo.dev 에서 계정을 만든다.
2. 로그인: `npx eas-cli@latest login` (구글로 가입했으면 브라우저에서 구글로 로그인. 비대화형 셸이면 `login --device --non-interactive`로 받은 주소를 브라우저에서 승인한 뒤 안내된 `--resume` 명령을 실행)
3. 프로젝트 연결: `npx eas-cli@latest init`
   - Expo에 `kkilog` 프로젝트를 만들고, `app.json`에 `extra.eas.projectId`와 `owner`를 써 넣는다.
4. 업데이트 연결: `npx eas-cli@latest update:configure`
   - `app.json`의 `updates.url`을 채운다. `runtimeVersion`은 이미 `appVersion` 정책으로 잡혀 있다.
5. 운영 API 주소를 EAS 환경변수로 등록한다. **첫 빌드 전에 반드시** 해야 한다(빌드와 OTA 모두 이 값을 쓴다. 없으면 앱의 모든 요청이 실패한다).
   - `npx eas-cli@latest env:set --name EXPO_PUBLIC_API_BASE_URL --value https://api-rouge-kappa-59.vercel.app --environment production --visibility plaintext --scope project`
   - 확인: `npx eas-cli@latest env:list --environment production`
   - 공개 값이라 plaintext로 둔다(APK 안에 그대로 들어간다). 앱에는 이 변수 말고 다른 환경변수를 넣지 않는다.
6. 3·4에서 바뀐 `app.json`을 feature 브랜치 → `dev` PR로 커밋한다. 비밀 값이 아니다.

`apps/mobile/.env.local`은 로컬 개발(`expo start`)에서만 쓴다. EAS 빌드·업데이트는 EAS의 `production` 환경변수를 쓰고 이 파일을 보지 않는다.

## 첫 APK 빌드
1. 운영 서버(`main`)가 앱 코드와 맞는 버전인지 확인한다. 빌드는 지금 브랜치의 앱 코드로 만들어지고, API는 EAS `production` 환경변수의 주소를 부른다.
2. `npx eas-cli@latest build -p android --profile production`
   - 서명 키(keystore)를 만들지 물으면 **Yes**. 키는 EAS가 보관한다. **저장소에 넣지 않는다.**
   - 클라우드에서 10~20분 걸린다. 끝나면 APK 다운로드 링크(expo.dev)가 나온다.
3. 그 링크를 지인들에게 보낸다([install.md](install.md)).
4. 서명 키 백업: `npx eas-cli@latest credentials` → Android → production → keystore 다운로드. 저장소 밖의 안전한 곳에 둔다. 키를 잃으면 같은 앱으로 덮어 설치할 수 없다(지우고 새로 설치해야 함).

## 수정을 반영할 때
| 바꾼 것 | 방법 |
| --- | --- |
| 서버(API·프롬프트·DB) | `dev` → `main` 릴리스 PR merge(Vercel 배포). 앱은 그대로 |
| 앱 화면·로직(JS만) | **OTA 업데이트** — 아래 |
| 네이티브(새 Expo 모듈, `app.json`의 권한·아이콘·이름·플러그인) | **APK 다시 빌드** — 아래 |

### OTA 업데이트 (JS만 바뀌었을 때)
1. 바뀐 앱 코드가 `main`에 들어가 있고, 필요한 서버 변경도 운영에 배포돼 있어야 한다(앱이 운영 API를 부르므로).
2. `main`을 받은 상태에서: `npx eas-cli@latest update --channel production --environment production --message "무엇을 바꿨는지"`
   - EAS의 `production` 환경변수로 번들이 만들어진다(로컬 `.env`는 쓰지 않음). SDK 55 이상에선 `--environment`가 필수다.
3. 사용자는 앱을 완전히 껐다 켜면 받는다. 시작할 때 확인하고 내려받아 다음 실행부터 적용된다.
4. 잘못 올렸으면 `npx eas-cli@latest update:republish`로 이전 업데이트를 다시 올리거나(이미 만든 번들을 다시 올리는 것이라 `--environment`가 없다), 고친 코드로 2번처럼 새 업데이트를 올린다.

### APK 다시 빌드 (네이티브가 바뀌었을 때)
1. `app.json`의 `version`을 올리고(예: `1.0.0` → `1.1.0`) `android.versionCode`를 1 올린다.
   - `runtimeVersion`이 `version`을 따르므로, 예전 APK는 새 OTA를 받지 않는다(네이티브가 안 맞는 번들을 받아 죽는 일을 막음).
2. 첫 빌드와 같은 명령으로 빌드하고, 새 링크를 보낸다. 사용자는 덮어 설치하면 된다. 기록은 서버에 있어서 그대로다.

## 확인 목록
배포 후 확인할 항목은 `docs/spec.md` 12절.
