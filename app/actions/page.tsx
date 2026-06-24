"use client";
import { useCallback, useEffect, useState } from "react";
import Chrome from "@/components/Chrome";
import { Pill, Spinner, Toast } from "@/components/ui";

const FILTERS: [string, string][] = [["all", "전체"], ["def", "지적사항"], ["mal", "오동작"]];

export default function Actions() {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string>("");
  const [note, setNote] = useState("");
  const [confirmer, setConfirmer] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback((f: string) => {
    setItems(null);
    fetch(`/api/actions?filter=${f}`).then((r) => r.json()).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);
  useEffect(() => {
    const t = sessionStorage.getItem("ps_toast");
    if (t) { setToast(t); sessionStorage.removeItem("ps_toast"); setTimeout(() => setToast(""), 3500); }
  }, []);

  async function submit(it: any) {
    if (!note.trim()) { setToast("조치 내용을 입력해 주세요."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: it.kind, id: it.id, note, confirmer }),
      });
      const d = await r.json();
      if (!r.ok) { setToast(d.error || "저장 실패"); return; }
      setOpen(""); setNote(""); setConfirmer("");
      setToast("조치 완료로 전환되었습니다.");
      setTimeout(() => setToast(""), 3000);
      load(filter);
    } finally { setBusy(false); }
  }

  return (
    <Chrome title="작업 조치 관리" active="check">
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {FILTERS.map(([k, label]) => {
          const on = filter === k;
          return <button key={k} onClick={() => setFilter(k)} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", border: `1px solid ${on ? "var(--brand)" : "var(--bd)"}`, background: on ? "var(--brand-bg)" : "var(--white)", color: on ? "var(--brand-tx)" : "var(--sub)" }}>{label}</button>;
        })}
      </div>

      {!items ? <Spinner /> : items.length === 0 ? (
        <div style={{ color: "var(--hint)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>항목이 없습니다.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <div key={it.kind + it.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, minWidth: 0 }}>{it.title}</div>
                <Pill label={it.status} />
              </div>
              <div style={{ fontSize: 12, color: "var(--sub)", margin: "5px 0 10px" }}>{it.sub}</div>
              {it.pending ? (
                open === it.kind + it.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="조치 내용" style={{ padding: 11, fontSize: 14, resize: "none" }} />
                    <input value={confirmer} onChange={(e) => setConfirmer(e.target.value)} placeholder="확인자 (선택)" style={{ padding: "10px 12px", fontSize: 14 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setOpen(""); setNote(""); }} style={{ flex: 1, padding: 11, background: "var(--white)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 13, color: "var(--sub)", cursor: "pointer" }}>취소</button>
                      <button onClick={() => submit(it)} disabled={busy} className="btn-primary" style={{ flex: 2, padding: 11, fontSize: 14, border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "저장 중…" : "조치 완료"}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setOpen(it.kind + it.id); setNote(""); setConfirmer(""); }} style={{ width: "100%", padding: 10, background: "var(--brand-bg)", color: "var(--brand-tx)", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>조치 입력 →</button>
                )
              ) : null}
            </div>
          ))}
        </div>
      )}
      <Toast msg={toast} type={toast.includes("입력") ? "bad" : "ok"} />
    </Chrome>
  );
}
