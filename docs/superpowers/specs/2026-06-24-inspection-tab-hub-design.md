# 설계: 하단 탭 "스캔" → "오늘점검" 교체 + 점검 허브 화면

- 날짜: 2026-06-24
- 상태: 승인됨 (구현 대기)
- 관련 PRD: §5.1 핵심 흐름, §6.1 대시보드 빠른 진입, §6.3 안전점검(회차 모델), §6.7 QR 딥링크

## 1. 목적 / 배경

현재 하단 탭은 `홈 · 스캔 · 조치`인데, "스캔"은 PRD상 **페이지가 아니라 진입 수단**
(대시보드 CTA §6.1 + QR 딥링크 §6.7 + 점검 흐름 내부 §5.1)이다. 반면 "점검(안전점검)"은
PRD의 **1급 페이지(§6.3)**. 따라서 스캔 탭을 내리고 **점검 허브 화면**을 탭으로 승격한다.

- 탭 라벨: **"오늘점검"** (today 중심), 라우트 `/inspection`
- 점검 화면 수준: **인테림 허브** (PRD §6.3 회차/Task 모델은 Phase 2에서 이 허브를 확장)

### PRD 충돌 검토 결과 — 충돌 없음
- 점검은 PRD 1급 페이지 → 탭 승격 정합 (§6.3)
- 스캔은 PRD에 독립 페이지로 없음 → 탭에서 내려도 위반 아님. 단 **기능은 유지**(허브 버튼 + `?eq=` 딥링크) (§5.1, §6.7)
- 회차 모델 미구현분은 Phase 2로 분리 (허브를 회차 목록으로 확장)

## 2. 범위

확정 요구:
- 하단 탭 `홈 · 오늘점검 · 조치` (스캔 탭 제거, 오늘점검 탭 추가)
- 오늘점검 허브 = **QR 스캔 시작 버튼 + 장비 ID 수동 입력 + 오늘 점검 목록**
- 홈의 "QR 스캔 점검" 버튼 **제거**(중복 해소)
- 스캔은 기존 `/scan` 카메라 화면 재사용(허브 버튼으로 진입)

비범위(YAGNI): 회차(Round)/Task 모델, 일정 등록, 점검 대상 큐 — Phase 2.

## 3. 아키텍처 / 라우팅

```
하단 탭:  홈(/)  ·  오늘점검(/inspection)  ·  조치(/actions)
                         │
   ┌─────────────────────┼───────────────────────┐
   │ QR 스캔 시작 버튼      │ 장비 ID 수동 입력        │ 오늘 점검 목록
   ▼                     ▼                        ▼
 /scan (카메라) ──decode──▶ /inspect?eq=         GET /api/today → 탭 → DetailSheet(재사용)
   (기존)                   (기존)                   (신규 엔드포인트)
 외부 QR ?eq= 딥링크 ───────▶ /inspect?eq= (그대로)
```

- `/scan`, `/inspect`는 변경 없음(재사용). 단 Chrome `active` 키는 점검 흐름 내내 `inspect`로 두어 **오늘점검 탭 강조 유지**.

## 4. 컴포넌트 / 파일

### 4.1 `components/Chrome.tsx` (수정)
- 탭 배열: `home → / · inspect → /inspection · check → /actions`.
- 라벨: 홈 / **오늘점검** / 조치.
- `active` 타입 `"home" | "scan" | "check"` → `"home" | "inspect" | "check"`.
- 오늘점검 아이콘: 달력+체크형(today 의미). (스캔 아이콘은 허브 버튼으로 이동)

### 4.2 `app/inspection/page.tsx` (신규, client, `active="inspect"`)
- 상단 큰 버튼 **"QR 스캔으로 점검 시작"** → `router.push("/scan")`
- **장비 ID 수동 입력** + [점검] → `router.push("/inspect?eq=" + encodeURIComponent(id))`
- **오늘 점검** 섹션: `GET /api/today` 목록 → 각 항목 탭 → `setDetail({kind,id})` → `<DetailSheet>`(기존 재사용). 빈 경우 "오늘 점검 기록이 없습니다."

### 4.3 `app/api/today/route.ts` (신규)
- 인증 필수(`getUser`).
- 오늘(KST, `today()`) `inspection_date`(def) / `occurred_on`(mal) == today 인 레코드.
- 반환: `{ items: [{ kind, id, title, sub, result, date }] }` (홈 recent와 동일 형태; 정렬 최신순).
  - def title: 양호면 `${floor}/${zone} 점검`, 아니면 `issue`. result: 양호/불량.
  - mal title: `detail`, result: 오동작.

### 4.4 `app/page.tsx` (수정)
- "QR 스캔 점검" 버튼 블록 제거. KPI + 최근 점검(탭→상세) 유지.

### 4.5 `app/scan/page.tsx`, `app/inspect/page.tsx` (수정)
- `<Chrome active="scan" ...>` → `active="inspect"` (탭 강조 일관).

## 5. 에러 / 엣지

- `/api/today` 실패 → 빈 목록 렌더(허브는 버튼·입력 정상).
- 수동 입력 공란 → 이동 안 함.
- 카메라 권한/스캔 실패 → 기존 `/scan` 동작 그대로(수동 입력 fallback 존재).
- 딥링크 `?eq=` → 기존대로 `/inspect` 직접 진입(탭 강조는 inspect).

## 6. 테스트 (writing-plans에서 구체화)

- `GET /api/today`: 오늘 def/mal 반환·형태 검증, 비로그인 401.
- 미리보기:
  - 하단 탭에 "오늘점검" 표시, "스캔" 없음
  - 오늘점검 탭 → 허브 렌더(버튼·입력·목록)
  - "QR 스캔으로 점검 시작" → /scan
  - 수동 입력 → /inspect?eq=
  - 오늘 점검 항목 탭 → DetailSheet
  - 홈에 "QR 스캔 점검" 버튼 없음
  - /scan·/inspect 화면에서 오늘점검 탭 강조 유지
  - 콘솔 에러 0

## 7. 영향 파일

- 신규: `app/inspection/page.tsx`, `app/api/today/route.ts`
- 수정: `components/Chrome.tsx`, `app/page.tsx`, `app/scan/page.tsx`, `app/inspect/page.tsx`
- 재사용: `components/DetailSheet.tsx`, `components/ui.tsx`
