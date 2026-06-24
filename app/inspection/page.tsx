"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Chrome from "@/components/Chrome";
import { Spinner } from "@/components/ui";

function extractEq(text: string) {
  try {
    const u = new URL(text);
    const eq = u.searchParams.get("eq");
    if (eq) return eq;
  } catch {}
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
