# 오늘점검 탭 + 점검 허브 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans 로 task 단위 실행. 단계는 체크박스(`- [ ]`).

**Goal:** 하단 탭 "스캔"을 "오늘점검"으로 교체하고, 점검 허브 화면(/inspection)을 도입한다.

**Architecture:** 점검 허브가 스캔 시작·수동 입력·오늘 점검 목록의 진입점이 되고, 기존 `/scan`·`/inspect`·`DetailSheet`를 재사용한다. 홈의 스캔 버튼은 제거(중복 해소).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, @supabase/supabase-js(service_role).

## Global Constraints

- service_role는 서버 전용(`admin()`), 인증은 `getUser()` 게이트.
- 파일 쓰기 desktop-commander, 커밋은 명시 경로(`git add <paths>`), `git add -A` 금지.
- 검증: dev 서버 HTTP + 브라우저 미리보기. 인증 필요 호출은 브라우저 fetch(쿠키) 사용.
- 탭 active 키: `"home" | "inspect" | "check"` (기존 `scan` → `inspect`).
- "오늘점검" 탭 라벨, 라우트 `/inspection`. 스캔은 `/scan`(기존) 재사용.

---

## File Structure

- `app/api/today/route.ts` (신규) — 오늘 점검 레코드 목록
- `app/inspection/page.tsx` (신규) — 점검 허브 (스캔 시작·수동·오늘 목록)
- `components/Chrome.tsx` (수정) — 탭: 홈/오늘점검/조치, active scan→inspect, 아이콘
- `app/page.tsx` (수정) — 홈 "QR 스캔 점검" 버튼 제거
- `app/scan/page.tsx`, `app/inspect/page.tsx` (수정) — `active="inspect"`
- 재사용: `components/DetailSheet.tsx`, `components/ui.tsx`

---

## Task 1: `GET /api/today`

**Files:** Create `app/api/today/route.ts`

**Interfaces:** Produces `GET /api/today` → `{ items: [{kind,id,ts,title,sub,result,date}] }`

- [ ] **Step 1: 구현**

```ts
import { NextResponse } from "next/server";
import { admin, today } from "@/lib/supa";
import { getUser } from "@/lib/session";

const isGood = (issue: string | null) => (issue ?? "").trim().startsWith("양호");

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = admin();
  const t = today();
  const [defs, mals] = await Promise.all([
    db.from("deficiencies").select("*").order("inspection_date", { ascending: false }).limit(200),
    db.from("malfunctions").select("*").order("occurred_on", { ascending: false }).limit(200),
  ]);
  const D = (defs.data ?? []).filter((d) => String(d.inspection_date).slice(0, 10) === t);
  const M = (mals.data ?? []).filter((m) => String(m.occurred_on).slice(0, 10) === t);
  const items = [
    ...D.map((d) => ({
      kind: "def", id: d.deficiency_id, ts: String(d.inspection_date),
      title: isGood(d) ? `${d.floor}/${d.zone} 점검` : d.issue,
      sub: `${d.floor}/${d.zone}`, result: isGood(d) ? "양호" : "불량",
      date: String(d.inspection_date).slice(0, 10),
    })),
    ...M.map((m) => ({
      kind: "mal", id: m.malfunction_id, ts: String(m.occurred_on),
      title: m.detail, sub: m.category, result: "오동작",
      date: String(m.occurred_on).slice(0, 10),
    })),
  ].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return NextResponse.json({ items });
}
```

- [ ] **Step 2: 검증** — `preview_eval`:

```js
(async()=>{ const d=await (await fetch('/api/today')).json(); return JSON.stringify({n:d.items.length, first:d.items[0]||null}); })()
```
Expected: 200, items 배열(오늘 레코드). 각 항목에 kind/id/result.

- [ ] **Step 3: 커밋**

```
git add "app/api/today/route.ts"
git commit -m "feat(today): 오늘 점검 목록 엔드포인트 GET /api/today"
```

---

## Task 2: 점검 허브 `/inspection`

**Files:** Create `app/inspection/page.tsx`

**Interfaces:** Consumes `/api/today`, `DetailSheet`, `Chrome(active="inspect")`

- [ ] **Step 1: 구현**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Chrome from "@/components/Chrome";
import DetailSheet from "@/components/DetailSheet";
import { Pill, Spinner } from "@/components/ui";

function extractEq(text: string) {
  try { const u = new URL(text); const eq = u.searchParams.get("eq"); if (eq) return eq; } catch {}
  return text.trim();
}

export default function Inspection() {
  const router = useRouter();
  const [items, setItems] = useState<any[] | null>(null);
  const [manual, setManual] = useState("");
  const [detail, setDetail] = useState<{ kind: string; id: string } | null>(null);

  useEffect(() => {
    fetch("/api/today").then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => setItems([]));
  }, []);

  function go() {
    if (manual.trim()) router.push(`/inspect?eq=${encodeURIComponent(extractEq(manual))}`);
  }

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

        <div style={{ fontSize: 13, color: "var(--sub)", fontWeight: 500, marginTop: 4 }}>오늘 점검</div>
        {!items ? <Spinner /> : (
          <div className="card" style={{ padding: "4px 14px" }}>
            {items.length === 0 && <div style={{ padding: "18px 0", color: "var(--hint)", fontSize: 13, textAlign: "center" }}>오늘 점검 기록이 없습니다.</div>}
            {items.map((r, i) => (
              <div key={i} onClick={() => setDetail({ kind: r.kind, id: r.id })} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid var(--bd)" : "none", gap: 10, cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 2 }}>{r.sub} · {r.date}</div>
                </div>
                <Pill label={r.result} />
              </div>
            ))}
          </div>
        )}
      </div>
      <DetailSheet sel={detail} onClose={() => setDetail(null)} />
    </Chrome>
  );
}
```

- [ ] **Step 2: 검증(미리보기)** — `/inspection` 진입 → 버튼·입력·오늘목록 렌더, 콘솔 에러 0. (탭은 Task 3 후 표시)
- [ ] **Step 3: 커밋**

```
git add app/inspection/page.tsx
git commit -m "feat(inspection): 점검 허브 화면 (스캔 시작·수동 입력·오늘 점검)"
```

---

## Task 3: Chrome 탭 교체 (스캔 → 오늘점검)

**Files:** Modify `components/Chrome.tsx`

- [ ] **Step 1: active 타입 변경** — `active?: "home" | "scan" | "check"` → `active?: "home" | "inspect" | "check"`

- [ ] **Step 2: 아이콘 맵 교체** — Icon 컴포넌트의 `p` 객체에서 `scan` 키를 `inspect`(달력+체크)로 교체:

```ts
  const p: Record<string, string> = {
    home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
    inspect: "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v3M16 3v3M9 14l2 2 4-4",
    check: "M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  };
```

- [ ] **Step 3: 탭 배열 교체** — nav `map`의 배열을:

```tsx
          {([["home", "홈", "/"], ["inspect", "오늘점검", "/inspection"], ["check", "조치", "/actions"]] as const).map(([k, label, href]) => (
```

- [ ] **Step 4: 검증(미리보기)** — 하단 탭에 "오늘점검" 표시, "스캔" 없음. 오늘점검 탭 클릭 → /inspection.
- [ ] **Step 5: 커밋**

```
git add components/Chrome.tsx
git commit -m "feat(nav): 하단 탭 스캔 → 오늘점검(/inspection) 교체 + 아이콘"
```

---

## Task 4: 홈 스캔버튼 제거 + scan/inspect 탭 강조

**Files:** Modify `app/page.tsx`, `app/scan/page.tsx`, `app/inspect/page.tsx`

- [ ] **Step 1: 홈 스캔버튼 제거** — `app/page.tsx`에서 아래 블록 삭제:

```tsx
          <button onClick={() => router.push("/scan")} className="btn-primary" style={{ padding: "17px", fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M7 12h10" /></svg>
            QR 스캔 점검
          </button>
```

- [ ] **Step 2: 홈 미사용 router 정리** — `app/page.tsx`에서 `import { useRouter } from "next/navigation";` 와 `const router = useRouter();` 삭제(스캔버튼이 유일 사용처였음).
- [ ] **Step 3: 스캔 화면 탭 강조** — `app/scan/page.tsx`의 `<Chrome title="QR 스캔" active="scan" back>` → `active="inspect"`.
- [ ] **Step 4: 점검입력 화면 탭 강조** — `app/inspect/page.tsx`의 `active="scan"` 3곳(에러/로딩/본문 Chrome) → `active="inspect"` 일괄.
- [ ] **Step 5: 검증(미리보기)** — 홈에 "QR 스캔 점검" 버튼 없음. /scan·/inspect 진입 시 "오늘점검" 탭 강조. 콘솔 에러 0.
- [ ] **Step 6: 커밋**

```
git add app/page.tsx app/scan/page.tsx app/inspect/page.tsx
git commit -m "feat: 홈 스캔버튼 제거 + scan/inspect 화면 오늘점검 탭 강조"
```

---

## Task 5: E2E 검증 + 배포

- [ ] **Step 1: 종합 미리보기** — 탭 홈/오늘점검/조치 표시 / 오늘점검 허브(스캔시작→/scan, 수동→/inspect, 오늘목록 탭→상세) / 홈 스캔버튼 없음 / 점검 흐름 탭 강조 / 딥링크 `/inspect?eq=EQ-0006` 정상 / 콘솔 에러 0.
- [ ] **Step 2: 푸시(자동 배포)**

```
git push origin main
```

- [ ] **Step 3: 배포 검증** — Vercel READY 후 로그인 → `/api/today` 200 확인.

---

## Self-Review

- 스펙 커버리지: §3 흐름=Task2 / §4.1 Chrome=Task3 / §4.2 허브=Task2 / §4.3 /api/today=Task1 / §4.4 홈=Task4 / §4.5 scan·inspect active=Task4 / §6 테스트=각 Task+Task5. 누락 없음.
- 플레이스홀더: 없음(코드 단계 실제 코드 포함).
- 타입 일관성: active `"home"|"inspect"|"check"`가 Chrome·scan·inspect·inspection에서 일치. `/api/today` 반환 키(kind/id/title/sub/result/date)가 허브 렌더와 일치. `DetailSheet sel={{kind,id}}` 일치.
