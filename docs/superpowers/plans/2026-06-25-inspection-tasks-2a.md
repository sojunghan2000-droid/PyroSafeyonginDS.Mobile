# 회차모델 2a (점검 대상 조회+수행) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans 로 task 단위 실행. 단계는 체크박스(`- [ ]`).

**Goal:** "오늘점검"에 미완료 점검 대상(Task)을 표시하고, Task 점검 시 task_id 연결 + Task Completed 처리.

**Architecture:** `/api/tasks`(목록)·`/api/task/[id]`(단건) 신설, 허브가 점검 대상 목록 표시, `/inspect`를 `?eq=`|`?task=` 듀얼 모드로 확장, `/api/inspect`가 taskId 수신 시 task_id 연결 + Task Completed.

**Tech Stack:** Next.js 16 App Router, React 19, TS, @supabase/supabase-js(service_role).

## Global Constraints

- service_role 서버 전용(`admin()`), `getUser()` 인증 게이트.
- 파일은 desktop-commander, 커밋은 명시 경로(`git add <paths>`), `git add -A` 금지.
- 검증: dev 미리보기 + 브라우저 fetch(쿠키).
- Task에는 `equipment_id` 없음 → 점검은 Task의 `floor/zone/equipment_label` 기반.
- urgency: due<today `지연` / ==today `오늘` / >today `예정` (KST `today()`).
- 상태 라벨 규칙은 기존 유지(양호→완료 등). 회차 등록(2b)은 비범위.

---

## File Structure

- `app/api/tasks/route.ts` (신규) — 미완료 점검 대상 목록
- `app/api/task/[id]/route.ts` (신규) — Task 단건(점검 화면용)
- `app/inspection/page.tsx` (수정) — 하단 목록을 점검 대상으로 교체
- `app/inspect/page.tsx` (수정) — `?task=` 듀얼 모드
- `app/api/inspect/route.ts` (수정) — taskId 지원 + Task Completed
- 재사용: `lib/supa.ts`, `components/ui.tsx`

---

## Task 1: `GET /api/tasks`

**Files:** Create `app/api/tasks/route.ts`

**Interfaces:** Produces `{ items: [{id,label,taskType,floor,zone,dueDate,roundId,urgency}] }`

- [ ] **Step 1: 구현**

```ts
import { NextResponse } from "next/server";
import { admin, today } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = admin();
  const t = today();
  const { data } = await db.from("inspection_tasks").select("*")
    .neq("status", "Completed").order("due_date", { ascending: true });
  const items = (data ?? [])
    .filter((r) => !r.excluded)
    .map((r) => {
      const due = String(r.due_date).slice(0, 10);
      const urgency = due < t ? "지연" : due === t ? "오늘" : "예정";
      return { id: r.task_id, label: r.equipment_label, taskType: r.task_type,
        floor: r.floor, zone: r.zone, dueDate: due, roundId: r.round_id, urgency };
    });
  return NextResponse.json({ items });
}
```

- [ ] **Step 2: 검증** — `preview_eval`:

```js
(async()=>{ const d=await (await fetch('/api/tasks')).json(); return JSON.stringify({n:d.items.length, first:d.items[0]||null, urg:[...new Set(d.items.map(i=>i.urgency))]}); })()
```
Expected: 200, items(미완료), urgency 값들.

- [ ] **Step 3: 커밋**

```
git add "app/api/tasks/route.ts"
git commit -m "feat(tasks): 미완료 점검 대상 목록 GET /api/tasks"
```

---

## Task 2: `GET /api/task/[id]`

**Files:** Create `app/api/task/[id]/route.ts`

**Interfaces:** Produces `{ id, label, taskType, floor, zone, roundId, status, note }`

- [ ] **Step 1: 디렉터리 생성**

```
New-Item -ItemType Directory -Force -Path "app\api\task\[id]"
```

- [ ] **Step 2: 구현**

```ts
import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  const { data: t } = await admin().from("inspection_tasks").select("*").eq("task_id", id).maybeSingle();
  if (!t) return NextResponse.json({ error: "점검 대상을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({
    id: t.task_id, label: t.equipment_label, taskType: t.task_type,
    floor: t.floor, zone: t.zone, roundId: t.round_id, status: t.status, note: t.note,
  });
}
```

- [ ] **Step 3: 검증** — `preview_eval` (Task1 결과의 첫 id 사용, 예 TSK-2029):

```js
(async()=>{ const r=await fetch('/api/task/TSK-2029'); return JSON.stringify({s:r.status, d:await r.json()}); })()
```
Expected: 200 + label/floor/zone. 없는 id → 404.

- [ ] **Step 4: 커밋**

```
git add "app/api/task/[id]/route.ts"
git commit -m "feat(task): Task 단건 조회 GET /api/task/[id]"
```

---

## Task 3: 오늘점검 허브 → 점검 대상 목록

**Files:** Modify `app/inspection/page.tsx` (전체 교체)

**Interfaces:** Consumes `/api/tasks`. 각 행 탭 → `/inspect?task=<id>`.

- [ ] **Step 1: 전체 교체**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Chrome from "@/components/Chrome";
import { Spinner } from "@/components/ui";

function extractEq(text: string) {
  try { const u = new URL(text); const eq = u.searchParams.get("eq"); if (eq) return eq; } catch {}
  return text.trim();
}

const URG: Record<string, { bg: string; tx: string }> = {
  지연: { bg: "var(--bad-bg)", tx: "var(--bad-tx)" },
  오늘: { bg: "var(--warn-bg)", tx: "var(--warn-tx)" },
  예정: { bg: "#f1f5f9", tx: "var(--sub)" },
};

export default function Inspection() {
  const router = useRouter();
  const [items, setItems] = useState<any[] | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    fetch("/api/tasks").then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => setItems([]));
  }, []);

  function go() { if (manual.trim()) router.push(`/inspect?eq=${encodeURIComponent(extractEq(manual))}`); }

  return (
    <Chrome title="오늘점검" active="inspect">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={() => router.push("/scan")} className="btn-primary" style={{ padding: "17px", fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M7 12h10" /></svg>
          QR 스캔으로 점검 시작
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="장비 ID 직접 입력 (예: EQ-0006)" onKeyDown={(e) => e.key === "Enter" && go()} style={{ flex: 1, padding: "12px 14px", fontSize: 14 }} />
          <button onClick={go} style={{ padding: "0 18px", background: "var(--white)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "var(--ink)", cursor: "pointer" }}>점검</button>
        </div>

        <div style={{ fontSize: 13, color: "var(--sub)", fontWeight: 500, marginTop: 4 }}>점검 대상</div>
        {!items ? <Spinner /> : (
          <div className="card" style={{ padding: "4px 14px" }}>
            {items.length === 0 && <div style={{ padding: "18px 0", color: "var(--hint)", fontSize: 13, textAlign: "center" }}>점검 대상이 없습니다.</div>}
            {items.map((it, i) => {
              const u = URG[it.urgency] ?? URG["예정"];
              return (
                <div key={it.id} onClick={() => router.push(`/inspect?task=${encodeURIComponent(it.id)}`)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid var(--bd)" : "none", gap: 10, cursor: "pointer" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
                    <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 2 }}>{it.floor}/{it.zone} · {it.taskType} · {it.dueDate}</div>
                  </div>
                  <span style={{ flex: "0 0 auto", background: u.bg, color: u.tx, fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 999 }}>{it.urgency}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Chrome>
  );
}
```

- [ ] **Step 2: 검증(미리보기)** — `/inspection` → "점검 대상" 목록 표시(미완료 Task), urgency 배지. 콘솔 에러 0. (탭→/inspect?task=는 Task5 후 완성)
- [ ] **Step 3: 커밋**

```
git add app/inspection/page.tsx
git commit -m "feat(inspection): 허브를 점검 대상(Task) 목록으로 전환"
```

---

## Task 4: `/api/inspect` 듀얼 모드 (taskId)

**Files:** Modify `app/api/inspect/route.ts` (전체 교체)

**Interfaces:** Consumes body `{ equipmentId?|taskId?, result, inspectionTypes, issue, malfunctionDetail, immediate }`. taskId 시 task_id 연결 + Task Completed.

- [ ] **Step 1: 전체 교체**

```ts
import { NextRequest, NextResponse } from "next/server";
import { admin, today, nextDeficiencyId, nextMalfunctionId, nextNoticeNo } from "@/lib/supa";
import { getUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json();
  const { equipmentId, taskId, result, issue, malfunctionDetail, immediate } = body;
  const inspectionTypes: string[] = body.inspectionTypes?.length ? body.inspectionTypes : ["임시소방시설"];
  const db = admin();
  const t = today();
  const inspector = user.name;

  let floor: string, zone: string, category: string;
  if (taskId) {
    const { data: task } = await db.from("inspection_tasks").select("*").eq("task_id", taskId).maybeSingle();
    if (!task) return NextResponse.json({ error: "점검 대상을 찾을 수 없습니다." }, { status: 404 });
    floor = task.floor; zone = task.zone; category = task.equipment_label;
  } else {
    const { data: eq } = await db.from("equipment").select("*").eq("equipment_id", equipmentId).maybeSingle();
    if (!eq) return NextResponse.json({ error: "장비를 찾을 수 없습니다." }, { status: 404 });
    floor = eq.floor; zone = eq.zone; category = eq.category;
  }

  async function afterSave(health?: "PASS" | "FAIL") {
    if (taskId) {
      await db.from("inspection_tasks").update({ status: "Completed" }).eq("task_id", taskId);
    } else if (equipmentId) {
      const patch: Record<string, unknown> = { last_inspection: t };
      if (health) patch.health_status = health;
      await db.from("equipment").update(patch).eq("equipment_id", equipmentId);
    }
  }

  if (result === "양호") {
    const id = await nextDeficiencyId();
    await db.from("deficiencies").insert({
      deficiency_id: id, inspection_date: t, inspector, floor, zone, inspection_types: inspectionTypes,
      issue: "양호", resolution: "완료", confirmer: inspector, notice_no: null,
      task_id: taskId ?? null, action_done: true, action_at: t, action_note: "",
    });
    await afterSave("PASS");
    return NextResponse.json({ ok: true, result, deficiencyId: id });
  }

  if (result === "불량") {
    if (!issue?.trim()) return NextResponse.json({ error: "지적사항을 입력해 주세요." }, { status: 400 });
    const done = Boolean(immediate?.note?.trim());
    const noticeNo = await nextNoticeNo(t);
    await db.from("notices").insert({
      notice_no: noticeNo, inspection_date: t, floor, zone, inspection_type: inspectionTypes[0], issue,
      photo_path: null, submitter: inspector, confirmer: done ? immediate.confirmer || inspector : inspector,
      action_done: done, action_at: done ? t : null, action_note: done ? immediate.note : "",
    });
    const id = await nextDeficiencyId();
    await db.from("deficiencies").insert({
      deficiency_id: id, inspection_date: t, inspector, floor, zone, inspection_types: inspectionTypes,
      issue, resolution: done ? "완료" : "불가", confirmer: done ? immediate.confirmer || inspector : null,
      notice_no: noticeNo, task_id: taskId ?? null,
      action_done: done, action_at: done ? t : null, action_note: done ? immediate.note : "",
    });
    await afterSave("FAIL");
    return NextResponse.json({ ok: true, result, deficiencyId: id, noticeNo });
  }

  if (result === "오동작") {
    if (!malfunctionDetail?.trim()) return NextResponse.json({ error: "오동작 내용을 입력해 주세요." }, { status: 400 });
    const id = await nextMalfunctionId();
    await db.from("malfunctions").insert({
      malfunction_id: id, category, occurred_on: t, detail: malfunctionDetail,
      action: "", confirmer: inspector, task_id: taskId ?? null, action_done: false,
    });
    await afterSave();
    return NextResponse.json({ ok: true, result, malfunctionId: id });
  }

  return NextResponse.json({ error: "알 수 없는 결과 유형입니다." }, { status: 400 });
}
```

- [ ] **Step 2: 검증** — Task5 후 통합 검증(브라우저 점검 흐름). 단독으로는 컴파일 에러 0 확인.
- [ ] **Step 3: 커밋**

```
git add app/api/inspect/route.ts
git commit -m "feat(inspect-api): taskId 지원 — task_id 연결 + Task Completed"
```

---

## Task 5: `/inspect` 듀얼 모드 (?task=)

**Files:** Modify `app/inspect/page.tsx` (전체 교체)

**Interfaces:** `?eq=`(장비) 또는 `?task=`(Task). task 시 `/api/task/[id]` 로드, 저장 시 `taskId` 전송, 저장 후 `/inspection` 복귀.

- [ ] **Step 1: 전체 교체**

```tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Chrome from "@/components/Chrome";
import { Pill, Spinner, Toast } from "@/components/ui";

const TYPES = ["임시소방시설", "피난로 등", "화기취급감독"];
type Result = "양호" | "불량" | "오동작";

function InspectInner() {
  const router = useRouter();
  const params = useSearchParams();
  const eq = params.get("eq") ?? "";
  const taskId = params.get("task") ?? "";
  const isTask = Boolean(taskId);

  const [subject, setSubject] = useState<any>(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [types, setTypes] = useState<string[]>(["임시소방시설"]);
  const [issue, setIssue] = useState("");
  const [malDetail, setMalDetail] = useState("");
  const [showImmediate, setShowImmediate] = useState(false);
  const [imNote, setImNote] = useState("");
  const [imConfirmer, setImConfirmer] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isTask) {
      fetch(`/api/task/${encodeURIComponent(taskId)}`).then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "조회 실패"); return; }
        setSubject({ task: true, title: d.label, line: `${d.floor} / ${d.zone}구역 · ${d.taskType}`, category: d.label });
      }).catch(() => setErr("네트워크 오류"));
      return;
    }
    if (!eq) { setErr("장비 ID가 없습니다."); return; }
    fetch(`/api/equipment/${encodeURIComponent(eq)}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "조회 실패"); return; }
      const e = d.equipment;
      setSubject({ task: false, title: `${e.equipment_id} · ${e.equipment_name}`, line: `${e.floor} / ${e.zone}구역 · ${e.category} · ${e.serial}`, category: e.category, qr_status: e.qr_status });
      if (d.justAssigned) setToast(`QR 첫 스캔 인식 — ${eq} 부착 완료(ASSIGNED) 전환`);
    }).catch(() => setErr("네트워크 오류"));
  }, [eq, taskId, isTask]);

  function toggleType(t: string) { setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t])); }

  async function save() {
    if (!result) { setToast("점검 결과를 선택해 주세요."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/inspect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId: isTask ? undefined : eq, taskId: isTask ? taskId : undefined,
          result, inspectionTypes: types, issue, malfunctionDetail: malDetail,
          immediate: showImmediate && imNote.trim() ? { note: imNote, confirmer: imConfirmer } : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setToast(d.error || "저장 실패"); return; }
      const msg = result === "불량" ? `저장 완료 · 통보서 ${d.noticeNo} 발급` : `저장 완료 (${result})`;
      sessionStorage.setItem("ps_toast", msg);
      router.replace(isTask ? "/inspection" : result === "양호" ? "/" : "/actions");
    } catch {
      setToast("네트워크 오류가 발생했습니다.");
    } finally { setBusy(false); }
  }

  if (err) return <Chrome title="점검 입력" active="inspect" back><div style={{ color: "var(--bad)", fontSize: 14, padding: "20px 0" }}>{err}</div></Chrome>;
  if (!subject) return <Chrome title="점검 입력" active="inspect" back><Spinner /></Chrome>;

  return (
    <Chrome title="점검 입력" active="inspect" back>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{subject.title}</div>
          <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 3 }}>{subject.line}</div>
          <div style={{ marginTop: 8 }}>
            <Pill label={subject.task ? "점검 대상" : subject.qr_status === "ASSIGNED" ? "QR 부착확인 ASSIGNED" : "부착 대기 PENDING"} />
          </div>
        </div>

        <div style={{ fontSize: 13, color: "var(--sub)", fontWeight: 500 }}>점검 결과</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["양호", "불량", "오동작"] as Result[]).map((r) => {
            const sel = result === r;
            const cmap: any = { 양호: ["var(--ok-bg)", "var(--ok-tx)"], 불량: ["var(--bad-bg)", "var(--bad-tx)"], 오동작: ["var(--warn-bg)", "var(--warn-tx)"] };
            return (
              <button key={r} onClick={() => setResult(r)} style={{ flex: 1, padding: "15px 0", background: cmap[r][0], color: cmap[r][1], border: sel ? `2px solid ${cmap[r][1]}` : "2px solid transparent", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{r}</button>
            );
          })}
        </div>

        {(result === "양호" || result === "불량") && (
          <div>
            <div style={{ fontSize: 12, color: "var(--sub)", fontWeight: 500, marginBottom: 6 }}>점검 종류 (별지5)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TYPES.map((t) => {
                const on = types.includes(t);
                return <button key={t} onClick={() => toggleType(t)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1px solid ${on ? "var(--brand)" : "var(--bd)"}`, background: on ? "var(--brand-bg)" : "var(--white)", color: on ? "var(--brand-tx)" : "var(--sub)" }}>{t}</button>;
              })}
            </div>
          </div>
        )}

        {result === "불량" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--sub)", fontWeight: 500 }}>지적사항</div>
            <textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={3} placeholder="지적사항을 입력하세요" style={{ padding: 12, fontSize: 14, resize: "none" }} />
            <button onClick={() => setShowImmediate((v) => !v)} style={{ textAlign: "left", padding: "11px 12px", background: "var(--white)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 13, color: "var(--sub)", cursor: "pointer" }}>
              {showImmediate ? "− 현장 즉시 조치 닫기" : "+ 현장 즉시 조치 (선택)"}
            </button>
            {showImmediate && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 2px" }}>
                <textarea value={imNote} onChange={(e) => setImNote(e.target.value)} rows={2} placeholder="조치 내용" style={{ padding: 12, fontSize: 14, resize: "none" }} />
                <input value={imConfirmer} onChange={(e) => setImConfirmer(e.target.value)} placeholder="확인자 (선택)" style={{ padding: "11px 12px", fontSize: 14 }} />
              </div>
            )}
          </div>
        )}

        {result === "오동작" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--sub)", fontWeight: 500 }}>오동작 내용 · 시설구분 {subject.category}</div>
            <textarea value={malDetail} onChange={(e) => setMalDetail(e.target.value)} rows={3} placeholder="오동작 내용을 입력하세요 (조치는 작업 조치 관리에서)" style={{ padding: 12, fontSize: 14, resize: "none" }} />
          </div>
        )}

        {result && (
          <button onClick={save} disabled={busy} className="btn-primary" style={{ padding: 16, fontSize: 16, border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "저장 중…" : result === "불량" ? "저장 · 통보서 발급" : "저장"}
          </button>
        )}
      </div>
      <Toast msg={toast} type={toast.includes("선택") || toast.includes("오류") ? "bad" : "ok"} />
    </Chrome>
  );
}

export default function Inspect() {
  return <Suspense fallback={<div className="shell" />}><InspectInner /></Suspense>;
}
```

- [ ] **Step 2: 검증(미리보기)** — `/inspection`에서 Task 탭 → `/inspect?task=` Task 헤더("점검 대상" 배지·라벨·층/구역·주기) 렌더, 콘솔 에러 0.
- [ ] **Step 3: 커밋**

```
git add app/inspect/page.tsx
git commit -m "feat(inspect): ?task= 듀얼 모드 — Task 기반 점검"
```

---

## Task 6: E2E 검증 + 배포

- [ ] **Step 1: 통합 미리보기** — 오늘점검 허브에 점검 대상 목록 / Task 탭 → 점검 화면(Task 헤더) / 양호 저장 → `/inspection` 복귀 + 해당 Task가 목록에서 사라짐(Completed) / `/inspect?task=`로 만든 deficiency의 task_id 연결 확인(DB 또는 /api/record). 기존 `/inspect?eq=` 흐름 정상(회귀 없음). 콘솔 에러 0.
- [ ] **Step 2: 푸시(자동 배포)**

```
git push origin main
```

- [ ] **Step 3: 배포 검증** — Vercel READY 후 로그인 → `/api/tasks` 200, `/inspection` 200.

---

## Self-Review

- 스펙 커버리지: §5.1 /api/tasks=T1 / §5.2 /api/task/[id]=T2 / §5.3 허브 목록=T3 / §5.4 inspect 듀얼=T5 / §5.5 inspect-api taskId+Completed=T4 / §6 에러=각 라우트 404·필터 / §7 테스트=각 Task+T6. 누락 없음.
- 플레이스홀더: 없음(모든 코드 단계 실제 코드).
- 타입 일관성: `/api/tasks` 항목 키(id,label,taskType,floor,zone,dueDate,roundId,urgency)=허브 렌더 일치. `/api/task/[id]` 키(label,floor,zone,taskType)=inspect subject 매핑 일치. inspect save body `{equipmentId|taskId}`=`/api/inspect` 수신 일치. `afterSave` health 인자 일치.
- 회귀 주의: `/api/inspect`·`/inspect`는 기존 `?eq=` 경로 동작 보존(T6에서 회귀 확인).
