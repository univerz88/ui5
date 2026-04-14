# SAP UI5 / Fiori 개발 지침

이 디렉토리는 SAP UI5 Fiori 앱 개발 프로젝트입니다.
사용자는 UI5 개발 경험이 없으므로 Claude가 전문가 역할을 담당합니다.

## 필수 워크플로우

### 새 프로젝트 시작 시
1. `get_guidelines` — UI5 개발 원칙 확인 (항상 먼저 호출)
2. `create_ui5_app` — 프로젝트 생성 (TypeScript, SAPUI5 최신 버전 기본)
3. `get_project_info` — 생성된 프로젝트 정보 확인

### 개발 중
- UI5 컨트롤 API가 불확실할 때 → `get_api_reference` 호출
- 코드 작성 완료 후 → `run_ui5_linter` 실행
- manifest.json 수정 후 → `run_manifest_validation` 실행

### 서버 실행
- 항상 `npm start`로 실행
- 브라우저에서 `http://localhost:8080/index.html` 로 접속 (루트 `/` 아님)

## 코딩 원칙

- **언어**: TypeScript 기본 사용
- **프레임워크**: SAPUI5 (특별한 이유 없으면 OpenUI5 사용 안 함)
- **모델**: manifest.json에서 관리 가능한 것은 manifest.json에서 설정
- **i18n**: 모든 UI 텍스트는 하드코딩 금지, i18n.properties로 관리
- **CSS**: SAP 기본 CSS 클래스 우선 사용, 커스텀 CSS는 최소화
- **Form**: SimpleForm 사용 금지, Form + ColumnLayout 사용

## 사용자 커뮤니케이션 원칙

- UI5 개념 설명 시 쉬운 비유 사용
- 각 Step 완료 후 무엇이 바뀌었는지 명확히 설명
- 화면에 보이는 변화와 내부 구조 변화를 구분해서 설명
- 오류 발생 시 원인을 먼저 설명하고 수정

## 프로젝트 구조 (표준)

```
webapp/
  controller/   — TypeScript Controller 파일
  view/         — XML View 파일
  model/        — formatter.ts, models.ts
  i18n/         — i18n.properties (다국어)
  css/          — 커스텀 CSS (최소화)
  Component.ts  — 앱 진입점
  manifest.json — 앱 설정 (모델, 라우팅 등)
  index.html    — HTML 부트스트랩
```
