"use client";
import { useCallback, useEffect, useState } from "react";
import Chrome from "@/components/Chrome";
import { Pill, Spinner, Toast } from "@/components/ui";

const FILTERS: [string, string][] = [
  ["all", "전체"], ["def", "지적사항"], ["mal", "오동작"], ["pending", "조치 대기만"],
];
type Kpis = { total: number; jijeok: number; pending: number; malfunction: number; actionRate: number };

function todayStr() {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // KST
  return d.toISOString().slice(0, 10);
}

export default function Actions() {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [items, setItems] = useState<any[] | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [open, setOpen] = useState("");
  const [note, setNote] = useState("");
  const [confirmer, setConfirmer] = useState("");
  const [actionDate, setActionDate] = useState(todayStr());
  const [file, setFile] = useState<File | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback((f: string, s: string) => {
    setItems(null);
    fetch(`/api/actions?filter=${f}&sort=${s}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items); setKpis(d.kpis); })
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { load(filter, sort); }, [filter, sort, load]);
  useEffect(() => {
    const t = sessionStorage.getItem("ps_toast");
    if (t) { setToast(t); sessionStorage.removeItem("ps_toast"); setTimeout(() => setToast(""), 3500); }
  }, []);

  function openForm(key: string) {
    setOpen(key); setNote(""); setConfirmer(""); setActionDate(todayStr()); setFile(null);
  }

  async function submit(it: any) {
    if (!note.trim()) { setToast("조치 내용을 입력해 주세요."); return; }
    setBusy(true);
    try {
      let photoPath: string | undefined;
      if (file && it.kind === "def") {
        const fd = new FormData();
        fd.append("file", file); fd.append("id", it.id);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const ud = await up.json();
        if (!up.ok) { setToast(ud.error || "사진 업로드 실패"); return; }
        photoPath = ud.path;
      }
      const r = await fetch("/api/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: it.kind, id: it.id, note, confirmer, actionDate, photoPath }),
      });
      const d = await r.json();
      if (!r.ok) { setToast(d.error || "저장 실패"); return; }
      setOpen("");
      setToast(photoPath ? "조치 완료 (사진 첨부됨)" : "조치 완료로 전환되었습니다.");
      setTimeout(() => setToast(""), 3000);
      load(filter, sort);
    } finally { setBusy(false); }
  }

  return (
    <Chrome title="작업 조치 관리" active="check">
      {/* KPI 5종 — 가로 스크롤 */}
      {kpis && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
          <Kpi label="전체 항목" val={kpis.total} />
          <Kpi label="지적사항" val={kpis.jijeok} />
          <Kpi label="통보서 대기" val={kpis.pending} tone="bad" />
          <Kpi label="오동작" val={kpis.malfunction} tone="warn" />
          <Kpi label="조치율" val={`${kpis.actionRate}%`} tone="brand" />
        </div>
      )}

      {/* 필터 + 정렬 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {FILTERS.map(([k, label]) => {
          const on = filter === k;
          return <button key={k} onClick={() => setFilter(k)} style={{ padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1px solid ${on ? "var(--brand)" : "var(--bd)"}`, background: on ? "var(--brand-bg)" : "var(--white)", color: on ? "var(--brand-tx)" : "var(--sub)" }}>{label}</button>;
        })}
        <button onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))} style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid var(--bd)", background: "var(--white)", color: "var(--sub)" }}>
          {sort === "newest" ? "↓ 최신순" : "↑ 오래된순"}
        </button>
      </div>

      {!items ? <Spinner /> : items.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>항목이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => {
            const key = it.kind + it.id;
            return (
              <div key={key} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, minWidth: 0 }}>{it.title}</div>
                  <Pill label={it.status} />
                </div>
                <div style={{ fontSize: 12, color: "var(--sub)", margin: "5px 0 10px" }}>
                  {it.sub} · {it.date}{it.hasPhoto ? " · 📷" : ""}
                </div>
                {it.pending && (
                  open === key ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="조치 내용" style={{ padding: 11, fontSize: 14, resize: "none" }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={confirmer} onChange={(e) => setConfirmer(e.target.value)} placeholder="확인자 (선택)" style={{ flex: 1, padding: "10px 12px", fontSize: 14 }} />
                        <input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} style={{ padding: "10px 12px", fontSize: 14 }} />
                      </div>
                      {it.kind === "def" && (
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--sub)", padding: "2px 2px" }}>
                          <span style={{ padding: "8px 12px", border: "1px solid var(--bd)", borderRadius: 8, background: "var(--white)", cursor: "pointer", whiteSpace: "nowrap" }}>📷 사진 선택</span>
                          <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file ? file.name : "선택 안 함"}</span>
                        </label>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setOpen("")} style={{ flex: 1, padding: 11, background: "var(--white)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 13, color: "var(--sub)", cursor: "pointer" }}>취소</button>
                        <button onClick={() => submit(it)} disabled={busy} className="btn-primary" style={{ flex: 2, padding: 11, fontSize: 14, border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "저장 중…" : "조치 완료"}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => openForm(key)} style={{ width: "100%", padding: 10, background: "var(--brand-bg)", color: "var(--brand-tx)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>조치 입력 →</button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
      <Toast msg={toast} type={toast.includes("입력") || toast.includes("실패") ? "bad" : "ok"} />
    </Chrome>
  );
}

function Kpi({ label, val, tone }: { label: string; val: number | string; tone?: "bad" | "warn" | "brand" }) {
  const color = tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--warn-tx)" : tone === "brand" ? "var(--brand-tx)" : "var(--ink)";
  return (
    <div style={{ flex: "0 0 auto", minWidth: 84, background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--sub)", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2, color }}>{val}</div>
    </div>
  );
}
