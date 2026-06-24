# 설계: 회차 모델 2a — 점검 대상(Task) 조회 + 수행

- 날짜: 2026-06-25
- 상태: 승인됨 (구현 대기)
- 관련 PRD: §6.3 안전점검(회차/Task/점검 시작), §7 데이터모델, §5.1 흐름

## 1. 배경 / 문제

"오늘점검" 화면이 비어 보이는 이유:
1. 현재 `/api/today`는 **오늘 완료된 점검 결과**(deficiencies/malfunctions)만 반환 — "해야 할 점검 대상"이 아님.
2. 점검 대상 = `inspection_tasks`(status≠Completed)인데 모바일이 이 테이블을 안 읽음.

라이브 DB 확인 결과 **회차 6건·Task 26건이 이미 존재**(Streamlit이 생성). 스키마/데이터를
새로 만들 필요 없이 **읽고 수행**하면 된다.

회차 모델 전체(PRD §6.3)는 크므로 분해: **2a = 점검 대상 조회 + 수행**(본 spec),
2b = 회차 등록(후순위). 2a가 "빈 화면" 문제를 직접 해결한다.

## 2. 범위 (2a)

- "오늘점검" 허브에 **미완료 점검 대상(Task) 전체**를 마감일 순·urgency 배지(지연/오늘/예정)로 표시
- Task 탭 → **Task 기반 점검**(`/inspect?task=`) → 저장 시 `task_id` 연결 + `inspection_tasks.status='Completed'`
- 목록 구성: **평면(마감일 순)**

비범위: 회차 등록/일정 생성(2b), 회차별 그룹 UI, +Task 추가, 제외, 도면 spot 정정.

## 3. 데이터 (실제 라이브 스키마)

```
inspection_tasks: task_id(PK), equipment_label, task_type, assignee, due_date,
  status(Scheduled|In Progress|Overdue|Completed), floor, zone, note, created_at,
  round_id(FK), excluded, excluded_at, excluded_by, excluded_reason
inspection_rounds: round_id(INS-YYYYMMDD-NNN), task_type, assignee, due_date, status, note, created_at
```
- **주의**: Task에는 `equipment_id`가 없음 → 점검은 장비ID가 아니라 Task의 `floor/zone/equipment_label` 기반(기존 deficiency도 floor/zone 기반).

## 4. 접근 — `/inspect` 듀얼 모드

기존 점검 화면을 `?eq=`(장비) 또는 `?task=`(Task) 둘 다 처리하도록 확장(점검 UI/로직 1벌 재사용, DRY). 별도 화면 신설 안 함.

## 5. 컴포넌트 / API

### 5.1 `GET /api/tasks` (신규)
- 인증 필수. `inspection_tasks`에서 `status≠'Completed'` AND `excluded≠true`, `due_date` 오름차순.
- urgency: `due_date < today` → `지연`, `== today` → `오늘`, `> today` → `예정` (today = KST `today()`).
- 반환: `{ items: [{ id, label, taskType, floor, zone, dueDate, roundId, urgency }] }`

### 5.2 `GET /api/task/[id]` (신규)
- 인증 필수. `inspection_tasks`에서 task_id 단건. 없으면 404.
- 반환: `{ id, label, taskType, floor, zone, roundId, status, note }`

### 5.3 `app/inspection/page.tsx` (수정)
- 하단 목록을 `/api/today`(오늘 완료) → **`/api/tasks`(점검 대상)** 로 교체.
- 섹션 제목 "점검 대상". 각 행: **전용 urgency 배지**(지연=빨강 var(--bad), 오늘=주황 var(--warn-tx), 예정=회색 var(--sub); 기존 `Pill`은 결과용이라 미사용) + `label` + `floor/zone · taskType · dueDate`. 탭 → `router.push('/inspect?task=' + id)`.
- 빈 경우 "점검 대상이 없습니다." 스캔 시작·수동 입력 버튼 유지.

### 5.4 `app/inspect/page.tsx` (수정 — 듀얼 모드)
- `useSearchParams`에서 `eq` 또는 `task` 읽기.
- `task` 있으면 `/api/task/[id]`로 Task 로드 → 헤더에 Task 정보(라벨·층/구역·주기) 표시(장비 카드 대체), `qr_status` 배지 없음.
- `eq` 경로는 기존과 동일(장비 + PENDING→ASSIGNED).
- 3분기(양호/불량/오동작)·점검종류·지적사항·현장 즉시 조치 UI 동일.
- 저장 POST body에 `taskId`(task 모드) 또는 `equipmentId`(eq 모드) 포함.

### 5.5 `POST /api/inspect` (수정 — taskId 지원)
- `taskId` 수신 시:
  - Task 로드 → floor/zone 사용(장비 조회 대신).
  - 양호/불량/오동작 분기 로직 동일하되 `floor/zone`은 Task에서, deficiency/malfunction에 `task_id=taskId` 설정.
  - 오동작 `category`는 Task `equipment_label` 사용(인테림).
  - 저장 후 `inspection_tasks.update({status:'Completed'}).eq('task_id',taskId)`.
- `equipmentId` 경로는 변경 없음(장비 + health_status 갱신 유지).

## 6. 에러 / 엣지

- `/api/tasks` 실패 → 빈 목록. `/api/task/[id]` 없음 → 404 → 점검 화면 "대상을 찾을 수 없습니다".
- 이미 Completed Task → 목록에서 제외(필터). 다시 점검 시도 시에도 저장은 동작(재완료).
- 인증 만료 → 미들웨어 /login.

## 7. 테스트 (writing-plans에서 구체화)

- `GET /api/tasks`: 미완료 N건 반환, urgency 분류(지연/오늘/예정), Completed/excluded 제외. 비로그인 401.
- `GET /api/task/[id]`: 단건 반환, 없는 id 404.
- 미리보기:
  - 오늘점검 허브에 점검 대상 목록 표시(현재 26건 중 미완료)
  - Task 탭 → `/inspect?task=TSK-xxxx` Task 정보 렌더
  - 양호 저장 → 해당 Task가 목록에서 사라짐(Completed) + deficiency.task_id 연결 확인
  - 불량 저장 → 통보서 발급 + task_id 연결 + Task Completed
  - 콘솔 에러 0

## 8. 영향 파일

- 신규: `app/api/tasks/route.ts`, `app/api/task/[id]/route.ts`
- 수정: `app/inspection/page.tsx`, `app/inspect/page.tsx`, `app/api/inspect/route.ts`
- 재사용: `components/ui.tsx`(Pill/Spinner), `lib/supa.ts`(admin/today)
