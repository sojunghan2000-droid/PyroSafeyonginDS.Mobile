# 점검 상세 바텀시트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans 로 task 단위 실행. 단계는 체크박스(`- [ ]`)로 추적.

**Goal:** 홈 최근점검 / 작업 조치 관리 리스트 항목을 탭하면 점검 기록의 읽기 전용 상세를 바텀시트로 표시.

**Architecture:** 전용 엔드포인트 `GET /api/record/[kind]/[id]`가 정규화된 상세 + 사진 서명URL을 반환하고, 공유 `DetailSheet` 컴포넌트를 홈/작업조치 두 화면이 재사용. 리스트는 `id`·`kind`만 보유.

**Tech Stack:** Next.js 16 (App Router, Route Handler), React 19, TypeScript, Tailwind v4, @supabase/supabase-js(service_role 서버측).

## Global Constraints

- service_role 키는 서버(Route Handler)에서만 사용. 브라우저 노출 금지. (`lib/supa.ts`의 `admin()`)
- 모든 데이터 접근은 `getUser()`(쿠키 세션)로 인증 게이트.
- 비공개 버킷 `action-photos` → 사진은 서버 생성 **서명 URL(600초)** 로만 노출.
- 파일 쓰기는 Guardian 훅 때문에 desktop-commander 사용. 커밋은 명시적 파일 경로로(`git add <paths>`), `git add -A` 금지.
- 검증: 단위 테스트 프레임워크 없음 → **dev 서버 HTTP 체크 + 브라우저 미리보기**로 검증. 인증 필요한 HTTP 체크는 브라우저 `fetch`(쿠키 자동) 또는 로그인 세션으로.
- 상태 라벨 규칙(스펙 §3): def 양호→`완료` / 불량+resolution='불가'→`불가` / 불량+action_done→`조치 완료` / 그외→`조치 대기`. mal: action_done?`조치 완료`:`조치 대기`.

---

## File Structure

- `app/api/record/[kind]/[id]/route.ts` (신규) — 상세 데이터 + 사진 서명URL 반환
- `components/DetailSheet.tsx` (신규) — 공유 바텀시트 (fetch + 렌더)
- `app/api/home/route.ts` (수정) — 최근점검 항목에 `id`·`kind` 추가
- `app/page.tsx` (수정) — 최근점검 행 탭 → 시트
- `app/actions/page.tsx` (수정) — 카드 본문 탭 → 시트
- 재사용: `components/ui.tsx`(Pill, Spinner)

---

## Task 1: 상세 엔드포인트 `GET /api/record/[kind]/[id]`

**Files:**
- Create: `app/api/record/[kind]/[id]/route.ts`

**Interfaces:**
- Consumes: `admin()`, `getUser()`
- Produces: `GET /api/record/{kind}/{id}` → 상세 JSON
  `{ kind, id, result, status, date, location, inspector, confirmer, inspectionTypes[], content, noticeNo, taskId, action:{done,at,note,photoUrl} }`

- [ ] **Step 1: 디렉터리 생성**

```
New-Item -ItemType Directory -Force -Path "app\api\record\[kind]\[id]"
```

- [ ] **Step 2: 라우트 구현** (desktop-commander 로 작성)

```ts
import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supa";
import { getUser } from "@/lib/session";

const BUCKET = "action-photos";
const isGood = (issue: string | null) => (issue ?? "").trim().startsWith("양호");

export async function GET(_req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { kind, id } = await ctx.params;
  const db = admin();

  if (kind === "def") {
    const { data: d } = await db.from("deficiencies").select("*").eq("deficiency_id", id).maybeSingle();
    if (!d) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    const good = isGood(d.issue);
    const status = good ? "완료" : d.resolution === "불가" ? "불가" : d.action_done ? "조치 완료" : "조치 대기";
    let photoUrl: string | null = null;
    if (d.action_photo_path) {
      const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(d.action_photo_path, 600);
      photoUrl = signed?.signedUrl ?? null;
    }
    return NextResponse.json({
      kind: "def", id: d.deficiency_id, result: good ? "양호" : "불량", status,
      date: String(d.inspection_date).slice(0, 10), location: `${d.floor}/${d.zone}`,
      inspector: d.inspector ?? null, confirmer: d.confirmer ?? null,
      inspectionTypes: d.inspection_types ?? [], content: d.issue ?? "",
      noticeNo: d.notice_no ?? null, taskId: d.task_id ?? null,
      action: { done: Boolean(d.action_done), at: d.action_at ? String(d.action_at).slice(0, 10) : null, note: d.action_note ?? null, photoUrl },
    });
  }

  if (kind === "mal") {
    const { data: m } = await db.from("malfunctions").select("*").eq("malfunction_id", id).maybeSingle();
    if (!m) return NextResponse.json({ error: "기록을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({
      kind: "mal", id: m.malfunction_id, result: "오동작",
      status: m.action_done ? "조치 완료" : "조치 대기",
      date: String(m.occurred_on).slice(0, 10), location: m.category ?? "",
      inspector: m.confirmer ?? null, confirmer: m.confirmer ?? null,
      inspectionTypes: [], content: m.detail ?? "", noticeNo: null, taskId: m.task_id ?? null,
      action: { done: Boolean(m.action_done), at: m.action_at ? String(m.action_at).slice(0, 10) : null, note: m.action_note ?? null, photoUrl: null },
    });
  }

  return NextResponse.json({ error: "알 수 없는 유형." }, { status: 400 });
}
```

- [ ] **Step 3: 검증 (브라우저 콘솔, 로그인 세션)** — dev 서버에서 `preview_eval`:

```js
(async()=>{ const r=await fetch('/api/record/mal/M-003'); return JSON.stringify({s:r.status, d:await r.json()}); })()
```
Expected: status 200, `result:"오동작"`, `content` 존재. 없는 id → 404. `kind=xxx` → 400.

- [ ] **Step 4: 커밋**

```
git add "app/api/record/[kind]/[id]/route.ts"
git commit -m "feat(record): 점검 상세 엔드포인트 GET /api/record/[kind]/[id]"
```

---

## Task 2: 홈 최근점검에 `id`·`kind` 추가

**Files:**
- Modify: `app/api/home/route.ts` (recent 매핑)

**Interfaces:**
- Produces: recent 항목에 `kind:"def"|"mal"`, `id` 추가 (기존 ts/title/sub/result 유지)

- [ ] **Step 1: recent 매핑 수정** — `...D.map`/`...M.map` 블록을 아래로 교체:

```ts
  const recent = [
    ...D.map((d) => ({
      kind: "def", id: d.deficiency_id,
      ts: String(d.inspection_date),
      title: isGood(d) ? `${d.floor}/${d.zone} 점검` : d.issue,
      sub: `${d.floor}/${d.zone} · ${String(d.inspection_date).slice(0, 10)}`,
      result: isGood(d) ? "양호" : "불량",
    })),
    ...M.map((m) => ({
      kind: "mal", id: m.malfunction_id,
      ts: String(m.occurred_on),
      title: m.detail,
      sub: `${m.category} · ${String(m.occurred_on).slice(0, 10)}`,
      result: "오동작",
    })),
  ]
    .sort((a, b) => (a.ts < b.ts ? 1 : -1))
    .slice(0, 6);
```

- [ ] **Step 2: 검증** — `preview_eval`:

```js
(async()=>{ const d=await (await fetch('/api/home')).json(); return JSON.stringify(d.recent[0]); })()
```
Expected: 첫 항목에 `kind`, `id` 포함.

- [ ] **Step 3: 커밋**

```
git add "app/api/home/route.ts"
git commit -m "feat(home): 최근점검 항목에 id·kind 추가 (상세 진입용)"
```

---

## Task 3: `DetailSheet` 공유 컴포넌트

**Files:**
- Create: `components/DetailSheet.tsx`

**Interfaces:**
- Consumes: `/api/record/{kind}/{id}`, `Pill`/`Spinner`(`components/ui`)
- Produces: `export default function DetailSheet({ sel, onClose }: { sel: {kind:string;id:string}|null; onClose: ()=>void })`

- [ ] **Step 1: 컴포넌트 작성** (desktop-commander):

```tsx
"use client";
import { useEffect, useState } from "react";
import { Pill, Spinner } from "@/components/ui";

type Sel = { kind: string; id: string } | null;

export default function DetailSheet({ sel, onClose }: { sel: Sel; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sel) return;
    setData(null); setErr("");
    fetch(`/api/record/${sel.kind}/${encodeURIComponent(sel.id)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "오류"); setData(d); })
      .catch((e) => setErr(e.message || "불러오지 못했습니다."));
  }, [sel]);

  if (!sel) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--white)", borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "85dvh", overflowY: "auto", padding: "10px 18px 28px" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 10px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--bd)" }} />
        </div>
        {err ? <div style={{ padding: "24px 0", color: "var(--bad)", fontSize: 14, textAlign: "center" }}>{err}</div>
          : !data ? <Spinner />
            : <Body d={data} />}
        <button onClick={onClose} style={{ width: "100%", marginTop: 14, padding: 13, background: "var(--white)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 14, color: "var(--sub)", cursor: "pointer" }}>닫기</button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: "1px solid var(--bd)", fontSize: 14 }}>
      <div style={{ flex: "0 0 84px", color: "var(--sub)" }}>{label}</div>
      <div style={{ flex: 1, fontWeight: 500, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function Photo({ url }: { url: string }) {
  const [bad, setBad] = useState(false);
  if (bad) return <div style={{ marginTop: 8, padding: "14px", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 13, color: "var(--hint)", textAlign: "center" }}>사진을 불러올 수 없습니다</div>;
  return <img src={url} alt="조치 사진" onError={() => setBad(true)} style={{ width: "100%", borderRadius: 10, marginTop: 8, border: "1px solid var(--bd)" }} />;
}

function Body({ d }: { d: any }) {
  const isMal = d.kind === "mal";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{d.id}</div>
        <Pill label={d.result} />
      </div>
      <Row label={isMal ? "시설구분" : "장소"} value={d.location} />
      <Row label="점검일" value={d.date} />
      <Row label={isMal ? "발견/확인자" : "점검자"} value={d.inspector} />
      {!isMal && d.inspectionTypes?.length ? <Row label="점검종류" value={d.inspectionTypes.join(", ")} /> : null}
      <Row label={isMal ? "오동작 내용" : "지적사항"} value={d.content} />
      <Row label="통보서" value={d.noticeNo} />
      <Row label="작업 ID" value={d.taskId} />
      <Row label="상태" value={d.status} />
      {d.action?.done && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--sub)", marginBottom: 2 }}>조치 이력</div>
          <Row label="조치일" value={d.action.at} />
          <Row label="조치내용" value={d.action.note} />
          <Row label="확인자" value={d.confirmer} />
          {d.action.photoUrl && <Photo url={d.action.photoUrl} />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크** — `npx tsc --noEmit` 또는 dev 서버 컴파일 에러 0 확인.
- [ ] **Step 3: 커밋**

```
git add components/DetailSheet.tsx
git commit -m "feat(ui): 점검 상세 바텀시트 DetailSheet 컴포넌트"
```

---

## Task 4: 홈 최근점검 → 시트 연결

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `DetailSheet`, recent 항목의 `kind`·`id`

- [ ] **Step 1: import + state 추가** — 상단 import에 `import DetailSheet from "@/components/DetailSheet";`, 컴포넌트 내 `const [detail, setDetail] = useState<{kind:string;id:string}|null>(null);`
- [ ] **Step 2: 최근점검 행을 탭 가능하게** — 각 recent row의 wrapper `div`에 `onClick={() => setDetail({ kind: r.kind, id: r.id })}` + `style`에 `cursor: "pointer"` 추가.
- [ ] **Step 3: 시트 렌더** — `</Chrome>` 직전(또는 Toast 옆)에 `<DetailSheet sel={detail} onClose={() => setDetail(null)} />` 추가.
- [ ] **Step 4: 검증(미리보기)** — 홈에서 최근점검 항목 탭 → 시트 오픈, 데이터 표시 확인. 콘솔 에러 0.
- [ ] **Step 5: 커밋**

```
git add app/page.tsx
git commit -m "feat(home): 최근점검 탭 → 상세 바텀시트"
```

---

## Task 5: 작업 조치 관리 → 시트 연결

**Files:**
- Modify: `app/actions/page.tsx`

**Interfaces:**
- Consumes: `DetailSheet`, 항목의 `kind`·`id` (이미 보유)

- [ ] **Step 1: import + state** — `import DetailSheet from "@/components/DetailSheet";`, `const [detail, setDetail] = useState<{kind:string;id:string}|null>(null);`
- [ ] **Step 2: 카드 본문 탭** — 카드 내 제목+sub 영역을 감싼 컨테이너에 `onClick={() => setDetail({ kind: it.kind, id: it.id })}` + `cursor:"pointer"`. (조치 입력 `<button>`은 분리되어 영향 없음; 필요 시 버튼 핸들러에 `e.stopPropagation()`은 불필요 — 버튼은 본문 컨테이너 밖.)
- [ ] **Step 3: 시트 렌더** — `<Toast .../>` 옆에 `<DetailSheet sel={detail} onClose={() => setDetail(null)} />`.
- [ ] **Step 4: 검증(미리보기)** — 작업 조치 카드 본문 탭 → 시트 오픈. 조치 대기 항목의 [조치 입력 →]은 정상 작동(시트와 충돌 없음). 콘솔 에러 0.
- [ ] **Step 5: 커밋**

```
git add app/actions/page.tsx
git commit -m "feat(actions): 카드 탭 → 상세 바텀시트"
```

---

## Task 6: E2E 검증 + 배포

- [ ] **Step 1: 미리보기 종합 검증** — 홈/작업조치에서 def(양호·불량+사진)·mal 각각 탭 → 상세 필드·상태·사진(있으면) 표시, 닫기(배경/X) 동작, 콘솔/네트워크 에러 0.
- [ ] **Step 2: 푸시(자동 배포)**

```
git push origin main
```

- [ ] **Step 3: 배포 검증** — Vercel 배포 READY 확인 후 `https://pyrosafe-mobile.vercel.app` 로그인 → `/api/record/...` 응답 정상 확인.

---

## Self-Review

- 스펙 커버리지: §2 흐름=Task1+4+5 / §3 API=Task1 / §4 리스트=Task2,4,5 / §5 컴포넌트=Task3 / §6 사진·에러=Task1(서명URL),Task3(Photo/err) / §7 테스트=각 Task 검증단계+Task6. 누락 없음.
- 플레이스홀더: 없음(모든 코드 단계에 실제 코드 포함).
- 타입 일관성: `sel:{kind,id}`·`DetailSheet` props·`/api/record` 반환 키가 Task 간 일치.
