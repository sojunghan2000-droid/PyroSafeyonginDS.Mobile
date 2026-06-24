"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Chrome from "@/components/Chrome";
import DetailSheet from "@/components/DetailSheet";
import { Pill, Spinner, Toast } from "@/components/ui";

type Home = { kpis: { inspectedToday: number; pending: number }; recent: any[] };

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<Home | null>(null);
  const [toast, setToast] = useState("");
  const [detail, setDetail] = useState<{ kind: string; id: string } | null>(null);

  useEffect(() => {
    fetch("/api/home").then((r) => r.json()).then(setData).catch(() => setData({ kpis: { inspectedToday: 0, pending: 0 }, recent: [] }));
    const t = sessionStorage.getItem("ps_toast");
    if (t) { setToast(t); sessionStorage.removeItem("ps_toast"); setTimeout(() => setToast(""), 3500); }
  }, []);

  return (
    <Chrome title="홈" active="home">
      {!data ? <Spinner /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <Stat label="오늘 점검" val={data.kpis.inspectedToday} />
            <Stat label="조치 대기" val={data.kpis.pending} danger />
          </div>

          <button onClick={() => router.push("/scan")} className="btn-primary" style={{ padding: "17px", fontSize: 16, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M7 12h10" /></svg>
            QR 스캔 점검
          </button>

          <div style={{ fontSize: 13, color: "var(--sub)", fontWeight: 500, marginTop: 4 }}>최근 점검</div>
          <div className="card" style={{ padding: "4px 14px" }}>
            {data.recent.length === 0 && <div style={{ padding: "18px 0", color: "var(--hint)", fontSize: 13, textAlign: "center" }}>아직 점검 기록이 없습니다.</div>}
            {data.recent.map((r, i) => (
              <div key={i} onClick={() => r.id && setDetail({ kind: r.kind, id: r.id })} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid var(--bd)" : "none", gap: 10, cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 2 }}>{r.sub}</div>
                </div>
                <Pill label={r.result} />
              </div>
            ))}
          </div>
        </div>
      )}
      <Toast msg={toast} />
      <DetailSheet sel={detail} onClose={() => setDetail(null)} />
    </Chrome>
  );
}

function Stat({ label, val, danger }: { label: string; val: number; danger?: boolean }) {
  return (
    <div style={{ flex: 1, background: "#f8fafc", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: "var(--sub)" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: danger ? "var(--bad)" : "var(--ink)" }}>{val}</div>
    </div>
  );
}
