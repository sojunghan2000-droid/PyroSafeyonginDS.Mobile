# 설계: 점검 상세 바텀시트 (Inspection Detail Sheet)

- 날짜: 2026-06-24
- 상태: 승인됨 (구현 대기)
- 관련 PRD: 6.3 회차 모달 "Completed Task 결과 카드", 6.4 작업 조치 관리 컬럼/상태

## 1. 목적 / 범위

홈 "최근 점검" 리스트와 "작업 조치 관리" 리스트의 항목을 탭하면, 해당 점검 기록
(별지5 지적사항 `deficiencies` 또는 별지9 오동작 `malfunctions`)의 **읽기 전용 상세**를
하단 바텀시트로 표시한다.

확정된 요구:
- 목적: **읽기 전용 정보 확인** (수정/재점검/조치 진입 없음)
- 표현: **바텀시트 모달** (슬라이드업 오버레이)
- 적용: **홈 최근점검 + 작업 조치 관리** 양쪽 (동일 컴포넌트 재사용)
- 내용 깊이: **전체 상세 + 조치 사진 이미지 표시**

비범위 (YAGNI): 상세에서의 조치 입력/편집/재점검, 회차 모델(점검ID·작업ID는 값이
있을 때만 표기), 사진 업로드(별도 기능).

## 2. 아키텍처 / 데이터 흐름

```
홈 최근점검 카드 ─┐
                 ├─ 탭 → setDetail({kind,id}) → <DetailSheet sel onClose>
작업 조치 카드 ──┘                                   │
                          GET /api/record/{kind}/{id}   (시트 열릴 때 1회)
                                   │ service_role 조회 + 사진 서명 URL
                          정규화된 상세 객체 → 바텀시트 렌더
```

접근 A 채택: 전용 상세 엔드포인트로 단일 출처·최신성·두 화면 재사용. 리스트는
`id`·`kind`만 보유해 가볍게 유지.

## 3. API: `GET /api/record/[kind]/[id]` (신규)

- 인증 필수 (`getUser()`; 없으면 401).
- `kind` ∈ {`def`, `mal`}. 그 외 400.
- **def**: `deficiencies`에서 `deficiency_id`로 단건 조회.
  - `notice_no` 있으면 `notices`에서 제출자(submitter) 보강.
  - `action_photo_path` 있으면 `admin().storage.from('action-photos').createSignedUrl(path, 600)`
    로 사진 URL 생성.
- **mal**: `malfunctions`에서 `malfunction_id`로 단건 조회 (사진 없음).
- 없으면 404.

반환 형태(정규화):
```jsonc
{
  "kind": "def|mal",
  "id": "D-2026-12 | M-003",
  "result": "양호 | 불량 | 오동작",
  "status": "완료 | 조치 완료 | 조치 대기 | 불가",
  "date": "YYYY-MM-DD",
  "location": "4F/A구역 | 감지기(시설구분)",
  "inspector": "박소방",
  "confirmer": "홍길동 | null",
  "inspectionTypes": ["임시소방시설", ...],   // def만, mal은 []
  "content": "지적사항 텍스트 | 오동작 내용",
  "noticeNo": "2026-06-24-02 | null",
  "taskId": "TSK-... | null",                  // 있을 때만 UI 표기
  "action": { "done": true, "at": "YYYY-MM-DD", "note": "...", "photoUrl": "https://... | null" }
}
```

### 상태(status) 도출 규칙
- def 양호(`issue` 가 "양호"로 시작) → `완료`
- def 불량:
  - `resolution === '불가'` → `불가`
  - `action_done` → `조치 완료`
  - 그 외 → `조치 대기`
- mal: `action_done` ? `조치 완료` : `조치 대기`

## 4. 리스트 변경

- `app/api/home/route.ts`: 최근점검 각 항목에 `id`(deficiency_id/malfunction_id)와
  `kind`('def'/'mal') 추가. 기존 필드(title/sub/result/ts) 유지.
- `app/page.tsx`: 최근점검 각 행을 버튼화 → 탭 시 `setDetail({kind,id})`.
- `app/actions/page.tsx`: 카드 본문(제목 영역) 탭 → `setDetail`. 기존 `[조치 입력 →]`
  버튼은 이벤트 분리해 유지. (`/api/actions`는 이미 `id`·`kind` 보유 → 변경 없음.)

## 5. 컴포넌트: `components/DetailSheet.tsx` (신규, client)

- Props: `sel: {kind,id} | null`, `onClose: () => void`.
- `sel` 변경 시 `/api/record/{kind}/{id}` fetch → 로딩(Spinner) → 콘텐츠.
- 레이아웃: 하단 슬라이드업, 셸 폭(최대 440px) 내 중앙, 상단 라운드 + 드래그 핸들,
  배경 딤(반투명). 닫기: 배경 탭 / 핸들 영역 / X 버튼.
- 콘텐츠:
  1. 헤더: 결과 Pill(기존 `ui.tsx`의 `Pill` 재사용) + ID
  2. 필드 행: 장소·시설 / 점검일 / 점검자 / 점검종류(칩) / 내용 / 통보서번호 / 상태
     (값 없는 행은 생략; taskId는 있을 때만)
  3. 조치 이력: 조치일 · 조치내용 · 확인자 · **사진 이미지**. 조치 없으면 "조치 이력 없음",
     양호는 이력 섹션 생략.

## 6. 사진 / 에러 처리

- 비공개 `action-photos` 버킷 → 서버에서 **서명 URL(600초)** 생성, 클라이언트 `<img>` 렌더.
- 이미지 로드 실패(`onError`) → "사진을 불러올 수 없습니다" 플레이스홀더.
- 레코드 없음(404) → 시트에 "기록을 찾을 수 없습니다".
- 네트워크 오류 → "불러오지 못했습니다" + 닫기.
- 인증 만료(401) → 미들웨어가 /login 리다이렉트(시트는 그냥 닫힘).

## 7. 테스트 (writing-plans에서 TDD로 구체화)

- API `/api/record`:
  - def 양호 → result=양호, status=완료, action.done 처리
  - def 불량+사진 → result=불량, photoUrl 생성, status=조치 완료/대기/불가 분기
  - mal → result=오동작, 사진 없음
  - 없는 id → 404, 잘못된 kind → 400, 비로그인 → 401
- 브라우저(프리뷰):
  - 홈 최근점검 탭 → 시트 오픈, 데이터 정확, 사진 표시
  - 작업 조치 카드 탭 → 시트 오픈 (조치 입력 버튼과 충돌 없음)
  - 닫기(배경/핸들/X) 동작, 콘솔 에러 0

## 8. 영향 파일

- 신규: `app/api/record/[kind]/[id]/route.ts`, `components/DetailSheet.tsx`
- 수정: `app/api/home/route.ts`, `app/page.tsx`, `app/actions/page.tsx`
- 재사용: `components/ui.tsx`(Pill, Spinner)
