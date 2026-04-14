# sap.dev.dashboard — 프로젝트 기획안

## 목적

SAP ERP 구축 프로젝트의 **개발 진행 현황을 한눈에 파악**하기 위한 모니터링 대시보드.  
기존 Claude Desktop에서 만든 HTML 대시보드를 SAP Fiori UI5 앱으로 정식 전환.

---

## 데이터 소스

- **입력 방식**: Excel 파일 업로드 (FileUploader)
- **파싱 라이브러리**: SheetJS (xlsx npm 패키지, ui5-tooling-modules로 번들링)
- **시트 구성**: SD / MM / PP / FI / CO / CM (모듈별 시트)
- **OData 연동 없음** — 오프라인 Excel 기반

### 주요 Excel 컬럼 (BASE_C 기준)
| 컬럼 | 의미 |
|------|------|
| mod (1) | 모듈 구분 (SD/MM/PP...) |
| serial (2) | 프로그램 일련번호 |
| zone (4) | 구분 (CA/HQ/VN) |
| name (6) | 프로그램명 |
| designer (19) | 설계자 |
| designP (20) | 설계 계획일 |
| designA (21) | 설계 실적일 |
| md (23) | 난이도 (M/D) |
| devWho (24) | 개발자 |
| devPlan (25) | 개발 계획일 |
| devAct (26) | 개발 실적일 |

> 시트마다 컬럼 위치가 다를 수 있어 `_detectOffset()` 함수로 자동 감지

---

## 핵심 기능

### 1. 모듈 탭 전환
- 전체 / SD / MM / PP / FI / CO / CM
- 탭 전환 시 모든 KPI·차트·테이블 즉시 갱신

### 2. KPI 카드 (6개)
| 카드 | 내용 |
|------|------|
| 전체 프로그램 수 | 선택 모듈 기준 |
| 설계 완료 | 설계 실적일 有 |
| 개발 완료 | 개발 실적일 有 |
| 잔여 프로그램 | 개발 미완료 |
| 잔여 M/D | 잔여 난이도 합계 |
| D-Day | 마감까지 영업일 |

### 3. 진행률 바
- 전체 개발 완료율
- 설계 완료 대비 개발 완료율
- 구분별 (CA / HQ / VN) 완료율

### 4. VizFrame 차트 (3개)
| 차트 | 유형 | 데이터 |
|------|------|------|
| 구분별 완료/잔여 | stacked_column | zone × done/remain |
| 잔여 M/D 분포 | donut | zone × md |
| 상태별 M/D | stacked_column | zone × over/risk/ok/none |

### 5. 잔여 프로그램 테이블
- 구분(CA/HQ/VN) 필터 탭
- GroupHeaderListItem으로 구분 그룹핑 (프로그래매틱 렌더링)
- 컬럼: No / 구분 / 프로그램명 / 개발계획일 / M/D / 가용일 / Gap / 상태 / 부하율

### 6. 드릴다운 모달 (2개)
| 모달 | 조건 |
|------|------|
| 설계완료 후 미개발 | designA 有 + devAct 無 |
| 설계 미완료 | designA 無 |

---

## 상태 판단 기준

| 상태 | 조건 |
|------|------|
| 마감초과 | 개발계획일 < 오늘 |
| 위험 | 개발계획일 < WARN_DT (2026-05-14) |
| 정상 | 그 외 계획일 있음 |
| 일정미정 | 개발계획일 없음 |

- **DEADLINE**: 2026-05-31
- **WARN_DT**: 2026-05-14

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | SAPUI5 1.146.0 |
| 언어 | TypeScript |
| 차트 | sap.viz (VizFrame) |
| Excel 파싱 | xlsx (npm) + ui5-tooling-modules |
| 테마 | SAP Horizon |
| 서버 | ui5 serve (npm start → localhost:8080) |

---

## 주요 파일

```
webapp/
  controller/Main.controller.ts   — 전체 비즈니스 로직
  model/formatter.ts              — 날짜 변환, 상태 판단, 영업일 계산
  view/Main.view.xml              — 전체 UI 구조
  css/style.css                   — 커스텀 스타일
  i18n/i18n.properties            — 한국어 텍스트
```

---

## 개발 이력

| 날짜 | 내용 |
|------|------|
| 2026-04 | Claude Desktop HTML 데모 제작 |
| 2026-04 | SAP Fiori UI5 TypeScript 앱으로 전환 |
| 2026-04 | VizFrame [S0053] 오류 수정 (프로그래매틱 데이터 설정) |
| 2026-04 | 헤더 URL 주소창 가림 문제 수정 (customHeader → title/headerContent) |
| 2026-04 | GitHub 연동 완료 (univerz88/ui5) |

---

## 참고

- 원본 HTML 시안: `demo.html` (동일 폴더에 보관 예정)
- GitHub: https://github.com/univerz88/ui5/tree/main/sap.dev.dashboard
