# 배포 가이드 (Vercel · 폰만으로)

이 저장소는 Vite 프로젝트라 Vercel이 자동 인식합니다. `vercel.json`에 빌드 설정을
미리 넣어두었으니 아래만 따라 하면 됩니다. **PC 없이 폰 브라우저만으로 가능.**

## 처음 한 번만 (약 2분)

1. 폰 브라우저로 **https://vercel.com** 접속 → **Sign Up / Log In**
2. **Continue with GitHub** 선택 → GitHub 로그인/권한 허용
3. 대시보드에서 **Add New… → Project**
4. **Import Git Repository** 목록에서 **`aedws/pokersts`** 선택
   - 목록에 안 보이면 **Adjust GitHub App Permissions**에서 이 저장소에 접근 허용
5. 설정 화면이 뜨면 그대로 두고 **Deploy** 탭 (프레임워크: Vite / 빌드: `npm run build` / 출력: `dist` 가 자동 채워짐)
6. 1~2분 빌드 후 **`https://pokersts.vercel.app`** 같은 주소가 생성됨 → 접속하면 게임 실행

## 그 다음부터

- 이 브랜치(`claude/poker-web-game-concept-vdpm2f`, 저장소 기본 브랜치)에 **푸시할 때마다 Vercel이 자동 재배포**합니다.
- 즉 앞으로 기능이 추가되면 별도 조작 없이 같은 주소에서 최신 버전이 뜹니다.

## 참고

- 프로덕션 배포는 **기본 브랜치**에서 나갑니다. 이 저장소는 기본 브랜치가 곧 작업 브랜치라
  바로 프로덕션으로 반영됩니다.
- 무료(Hobby) 플랜으로 충분합니다. 로그인·결제 정보 불필요.
