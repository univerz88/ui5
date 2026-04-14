# SAP 개발 진척 현황 대시보드 — 개발 가이드

> 작성일: 2026-04-14  
> 베이스 파일: `sap_dashboard.html`  
> 대상 데이터: 신원 개발 프로그램 리스트 및 진척 현황 (xlsx)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [파일 구조 및 기술 스택](#2-파일-구조-및-기술-스택)
3. [엑셀 데이터 규격](#3-엑셀-데이터-규격)
4. [핵심 로직 상세](#4-핵심-로직-상세)
5. [구현된 기능 목록](#5-구현된-기능-목록)
6. [수정 가이드](#6-수정-가이드)
7. [Claude Code (VS Code) 이어서 작업하기](#7-claude-code-vs-code-이어서-작업하기)
8. [향후 로드맵](#8-향후-로드맵)

---

## 1. 프로젝트 개요

### 목적
SAP 프로젝트의 개발 진척 현황을 엑셀 업로드만으로 즉시 시각화하는 대시보드.  
별도 서버 없이 HTML 단일 파일로 동작하며, 향후 SAP BTP 또는 Fiori Launchpad App으로 배포 예정.

### 동작 방식
```
엑셀 파일 업로드 → SheetJS로 브라우저 내 파싱 → Chart.js로 시각화
```

### 지원 모듈
`SD` · `MM` · `PP` · `FI` · `CO` · `CM`

---

## 2. 파일 구조 및 기술 스택

### 파일 구성
```
sap_dashboard.html      ← 단일 파일 (HTML + CSS + JS 통합)
```

### 외부 라이브러리 (CDN)
| 라이브러리 | 버전 | 용도 |
|-----------|------|------|
| Chart.js | 4.4.1 | 차트 렌더링 |
| SheetJS (xlsx) | 0.18.5 | 엑셀 파싱 |
| Google Fonts | — | Noto Sans KR, DM Mono |

### CSS 변수 (디자인 토큰)
```css
:root {
  --bg: #f4f5f7;        /* 배경 */
  --bg2: #fff;          /* 카드 배경 */
  --bg3: #eef0f3;       /* 보조 배경 */
  --text: #18191f;      /* 본문 */
  --text2: #5a5f72;     /* 보조 텍스트 */
  --text3: #9ea3b5;     /* 비활성 텍스트 */
  --ok: #059669;        /* 정상 (초록) */
  --risk: #d97706;      /* 위험 (주황) */
  --over: #dc2626;      /* 마감초과 (빨강) */
  --radius: 12px;
  --mono: 'DM Mono', monospace;
}
```

### 모듈별 컬러
```css
--c-SD: #0ea5e9;   --c-MM: #8b5cf6;   --c-PP: #f59e0b;
--c-FI: #2563eb;   --c-CO: #059669;   --c-CM: #ec4899;
--c-ALL: #64748b;
```

---

## 3. 엑셀 데이터 규격

### 지원 파일
- SD / MM / PP / FI / CO / CM 시트명을 가진 `.xlsx` 파일
- 각 시트의 컬럼 구조 동일

### 컬럼 인덱스 (BASE_C, 0-based)
| 키 | 엑셀 열 | 내용 |
|----|--------|------|
| mod | B열 (1) | 모듈명 (SD/MM/PP/FI/CO/CM) |
| serial | C열 (2) | Serial No |
| zone | E열 (4) | 적용범위 (CA/HQ/VN) |
| name | G열 (6) | 개발 프로그램 제목 |
| designer | T열 (19) | 설계자 |
| designP | U열 (20) | 설계 계획일 |
| designA | V열 (21) | 설계 실적일 |
| diff | W열 (22) | 난이도 |
| md | X열 (23) | 개발 공수 M/D |
| devWho | Y열 (24) | 개발자 |
| devPlan | Z열 (25) | 개발 계획일 |
| devAct | AA열 (26) | 개발 실적일 |

### 데이터 시작 행
- 10행: 집계행 (`계`)
- 11행~: 실제 데이터

### ⚠️ 중요: 열 오프셋 자동 감지
SheetJS가 시트를 파싱할 때 A열 존재 여부에 따라 배열 인덱스가 달라지는 현상이 있음.  
`detectOffset()` 함수로 모듈명이 실제로 위치한 인덱스를 감지해 보정함.

```js
function detectOffset(raw, mod) {
  for (let i = 0; i < Math.min(raw.length, 30); i++) {
    const row = raw[i];
    for (let j = 0; j < Math.min(row.length, 5); j++) {
      const v = String(row[j] || '').replace(/'/g, '').trim().toUpperCase();
      if (v === mod) return j - BASE_C.mod; // offset = 실제인덱스 - 기준인덱스
    }
  }
  return 0;
}
```

---

## 4. 핵심 로직 상세

### 4-1. 상태 판단 로직 (getStatus)

```js
const DEADLINE = new Date('2026-05-31');  // 개발 마감일
const WARN_DT  = new Date('2026-05-14');  // 위험 기준일 (통합테스트 시작)

function getStatus(planDate, md, today) {
  const p = excelDateToJS(planDate);
  if (!p || isNaN(p))  → '일정미정' (회색)
  if (p > DEADLINE)    → '정상'     (초록)  ← 5/31 이후 계획 = Open 이전 등 의도된 일정
  
  const av = workdays(today, p);           // 오늘~계획일 영업일수
  if (av < md)         → '마감초과' (빨강)  ← 가용일수 < 필요공수
  if (p > WARN_DT)     → '위험'     (주황)  ← 5/14 이후 계획
                       → '정상'     (초록)
}
```

**핵심 판단 기준 요약**

| 상태 | 조건 |
|------|------|
| 일정미정 | 개발 계획일 없음 |
| 정상 | 계획일 > 2026-05-31 (의도된 후속 일정) |
| 마감초과 | 계획일 ≤ 5/31 AND 가용 영업일 < M/D |
| 위험 | 계획일 ≤ 5/31 AND 계획일 > 5/14 |
| 정상 | 나머지 |

### 4-2. 설계 미완료 D-Day 계산

```js
// 설계 계획일 기준으로 D-Day 계산
if (planDate < today)   → "N일 지연" (빨강)
if (planDate == today)  → "오늘 마감" (주황)
if (planDate > today)   → "D-N" (초록)
```

### 4-3. 모달 표시 기준

| 모달 | 조건 | 정렬 |
|------|------|------|
| 설계완료 후 미개발 | designA 있음 AND devAct 없음 | 개발 계획일 오름차순 |
| 설계 미완료 | designA 없음 | 개발 계획일 오름차순 |

### 4-4. 전역 상태 객체

```js
let G = {
  modData: {           // 모듈별 파싱 데이터
    SD: [...],
    MM: [...],
    // ...
  },
  today: Date,         // 파싱 시점의 오늘 날짜
  curMod: 'ALL'        // 현재 선택된 모듈 탭
};
```

### 4-5. 각 행 데이터 구조

```js
{
  no: '0001',          // Serial No (4자리 패딩)
  mod: 'FI',           // 모듈명
  zone: 'CA',          // 적용범위 (CA/HQ/VN)
  name: '프로그램명',
  md: 3,               // 개발 공수
  designer: '홍길동',
  designPRaw: 46031,   // 설계 계획일 (Excel 시리얼 원본)
  designARaw: 46021,   // 설계 실적일 (Excel 시리얼 원본)
  designP: '2026-01-09', // 포맷팅된 날짜
  designA: '2026-01-08',
  devWho: '개발자명',
  devPlanRaw: ...,     // 개발 계획일 원본
  devActRaw: ...,      // 개발 실적일 원본
  devPlan: '2026-02-01',
  devAct: '2026-02-03',
}
```

---

## 5. 구현된 기능 목록

### 화면 구성
- **헤더**: 모듈 태그 (동적 색상) · 타이틀 · 기준일 · 엑셀 업로드 버튼
- **모듈 탭**: ALL / SD / MM / PP / FI / CO / CM
- **파싱 배너**: 성공/오류 메시지

### KPI 카드 (6개)
전체 프로그램 · 설계 완료 · 개발 완료 · 잔여 프로그램 · 잔여 M/D · 마감까지 남은 일

### 진행률 섹션
- 전체 개발 완료율
- **설계 완료 대비 개발 완료율** (노란 하이라이트)
- 구분별 (CA/HQ/VN) 진행률 바
- 설계 완료율

### 차트 3개
| 차트 | 타입 | 내용 |
|------|------|------|
| 구분별 완료/잔여 | 누적 바 | CA/HQ/VN별 완료 vs 잔여 |
| 잔여 M/D 분포 | 도넛 | 구분별 잔여 공수 비율 |
| 일정 상태별 M/D | 누적 바 | 마감초과/위험/정상/일정미정 |

### 잔여 프로그램 상세 테이블
- CA/HQ/VN 탭 필터
- 컬럼: No · 구분 · 프로그램명 · 개발계획일 · M/D · 가용일수 · 여유공수 · 상태 · 공수 부하율

### 모달 팝업 (2개)
1. **설계완료 후 미개발** — 클릭 링크↗, 구분별 탭, 경과일 표시
2. **설계 미완료** — 클릭 링크↗, 구분별 탭, 설계계획일 D-Day 표시

---

## 6. 수정 가이드

### 6-1. 마감일 변경

```js
// sap_dashboard.html 상단 상수 수정
const DEADLINE = new Date('2026-05-31');  // ← 변경
const WARN_DT  = new Date('2026-05-14');  // ← 변경 (통합테스트 시작일)
```

### 6-2. 지원 모듈 추가/제거

```js
// MODS 배열 수정
const MODS = ['SD', 'MM', 'PP', 'FI', 'CO', 'CM'];  // ← 여기 수정

// 모듈 컬러 추가
const MOD_COLOR = {
  ALL: '#64748b', SD: '#0ea5e9', MM: '#8b5cf6',
  PP: '#f59e0b',  FI: '#2563eb', CO: '#059669', CM: '#ec4899',
  // 새 모듈: 'XX': '#색상코드'
};
```

HTML의 모듈 탭 부분도 함께 추가:
```html
<div class="mtab" data-mod="XX" style="--mc:#색상코드" onclick="switchMod('XX')">
  <span>XX</span><span class="mcnt" id="mcnt-XX">—</span>
</div>
```

### 6-3. 컬럼 인덱스 변경 (엑셀 양식 변경 시)

```js
// BASE_C 객체 수정 (0-based 인덱스)
const BASE_C = {
  mod:      1,   // B열
  serial:   2,   // C열
  zone:     4,   // E열
  name:     6,   // G열
  designer: 19,  // T열  ← 양식 변경 시 이 값들을 수정
  designP:  20,  // U열
  designA:  21,  // V열
  diff:     22,  // W열
  md:       23,  // X열
  devWho:   24,  // Y열
  devPlan:  25,  // Z열
  devAct:   26,  // AA열
};
```

> **계산 방법**: A=0, B=1, C=2, ... Z=25, AA=26, AB=27 ...

### 6-4. 차트 추가

```js
// renderCharts 함수 내에 추가
killChart('newChart');
charts['newChart'] = new Chart(document.getElementById('newChart'), {
  type: 'bar',  // 'bar' | 'doughnut' | 'line' | 'pie'
  data: { ... },
  options: { responsive: true, maintainAspectRatio: false, ... }
});
```

HTML에 캔버스 추가:
```html
<div class="cc">
  <div class="cc-t">차트 제목</div>
  <div style="position:relative;height:190px">
    <canvas id="newChart" role="img" aria-label="차트 설명"></canvas>
  </div>
</div>
```

### 6-5. KPI 카드 추가

`renderKPI` 함수의 `innerHTML` 템플릿에 카드 추가:
```js
<div class="kpi">
  <div class="kpi-lbl">라벨</div>
  <div class="kpi-val" style="color:#색상">${값}</div>
  <div class="kpi-sub">서브텍스트</div>
  <div class="kpi-bw"><div class="kpi-bf" style="width:${비율}%;background:#색상"></div></div>
</div>
```

KPI 그리드 열 수 변경: `.kpi-grid { grid-template-columns: repeat(N, 1fr); }`

### 6-6. 테이블 컬럼 추가

`renderTable` 함수에서 `thead` 및 `tbody` 행 템플릿에 컬럼 추가.  
`table-layout: fixed` 이므로 `thead th`에 너비 클래스 추가 필요.

---

## 7. Claude Code (VS Code) 이어서 작업하기

### 7-1. 환경 준비

```bash
# Claude Code 확장 설치 후
code sap_dashboard.html
```

### 7-2. 작업 시작 시 Claude Code에 전달할 컨텍스트 프롬프트

아래 내용을 Claude Code 첫 대화에 붙여넣어 컨텍스트를 전달하세요:

---

```
이 파일은 SAP 개발 진척 현황 대시보드입니다.

## 기술 스택
- 단일 HTML 파일 (HTML + CSS + JS)
- SheetJS 0.18.5 (엑셀 파싱)
- Chart.js 4.4.1 (차트)

## 데이터 소스
- SD/MM/PP/FI/CO/CM 시트를 가진 SAP 개발 현황 엑셀 파일
- 집계행(계) 다음 행부터 데이터 시작
- BASE_C 객체로 컬럼 인덱스 정의, detectOffset()으로 시트별 열 오프셋 보정

## 전역 상태
- G.modData: 모듈별 파싱 데이터
- G.today: 기준일
- G.curMod: 현재 선택 모듈

## 상태 판단
- DEADLINE: 2026-05-31 (마감)
- WARN_DT: 2026-05-14 (위험 기준)
- 계획일 > DEADLINE → 정상 (의도된 후속 일정)
- 가용 영업일 < M/D → 마감초과

## 주요 함수
- parseAll(wb, fileName): 전체 모듈 파싱
- switchMod(mod): 모듈 탭 전환
- renderDashboard(data, today, mod): 대시보드 렌더
- openModal(): 설계완료 후 미개발 모달
- openNoDesignModal(): 설계 미완료 모달
```

---

### 7-3. 자주 사용하는 수정 요청 패턴

**차트 추가:**
```
잔여 테이블 위에 "개발자별 잔여 M/D" 바 차트를 추가해주세요.
데이터는 G.modData에서 현재 모듈의 devWho 기준으로 집계합니다.
```

**컬럼 변경:**
```
엑셀 양식이 변경되어 개발 실적일이 AA열(26)에서 AB열(27)로 이동했습니다.
BASE_C.devAct 를 27로 수정해주세요.
```

**신규 모듈 추가:**
```
PLM 모듈을 추가해주세요.
컬러코드는 #06b6d4 입니다.
기존 모듈과 동일한 컬럼 구조입니다.
```

**마감일 변경:**
```
프로젝트 마감일이 2026-06-30으로 연장되었습니다.
DEADLINE과 WARN_DT(2주 전인 2026-06-16)를 변경해주세요.
```

### 7-4. 주의사항

- `charts` 객체 관리: 차트 재렌더 전 반드시 `killChart(id)` 호출
- `G.curMod` 기준으로 현재 데이터 참조: `getCurData()` 함수 활용
- 모달에서 `G.today` 참조 시 항상 `setHours(0,0,0,0)` 된 값 사용
- SheetJS `raw:true` 모드: 날짜는 Excel 시리얼 숫자로 반환됨 → `excelDateToJS()` 변환 필수

---

## 8. 향후 로드맵

### Phase 1 — 현재 (완료)
- [x] 단일 HTML 데모 버전
- [x] SD/MM/PP/FI/CO/CM 멀티모듈 파싱
- [x] 모듈 탭 전환형 대시보드
- [x] KPI · 진행률 · 차트 · 잔여 테이블
- [x] 설계완료 후 미개발 / 설계 미완료 모달

### Phase 2 — 개선 예정
- [ ] 마감일/기준일 UI에서 직접 변경 기능
- [ ] 개발자별 공수 부하 분석 뷰
- [ ] 모듈간 비교 차트 (ALL 탭 강화)
- [ ] 데이터 내보내기 (PDF/PNG 스냅샷)

### Phase 3 — 정식 배포
- [ ] SAP UI5로 재구현 (XML View + Controller)
- [ ] OData 서비스 연동 (엑셀 업로드 → 실시간 데이터)
- [ ] BTP 또는 S/4HANA BSP 배포
- [ ] SAP Fiori Launchpad 등록

---

*마지막 업데이트: 2026-04-14*
