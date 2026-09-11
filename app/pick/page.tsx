"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Chrome from "@/components/Chrome";
import { Pill, Spinner } from "@/components/ui";

type Eq = {
  equipment_id: string;
  location_id: string;
  category: string;
  equipment_name: string;
  floor: string;
  zone: string;
  qr_status: string;
  health_status: string;
};

export default function Pick() {
  const router = useRouter();
  const [items, setItems] = useState<Eq[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/equipment").then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((e) =>
      [e.equipment_id, e.location_id, e.equipment_name, e.category, e.floor, e.zone]
        .some((v) => v?.toLowerCase().includes(s))
    );
  }, [items, q]);

  return (
    <Chrome title="점검 추가" active="inspect" back>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="장비 ID · 이름 · 위치로 검색 (예: EQ-0006, 소화기, B2)"
          style={{ padding: "12px 14px", fontSize: 14 }}
          autoFocus
        />
        {!items ? <Spinner /> : (
          <div className="card" style={{ padding: "4px 14px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "18px 0", color: "var(--hint)", fontSize: 13, textAlign: "center" }}>
                일치하는 장비가 없습니다.
              </div>
            )}
            {filtered.map((e, i) => (
              <div
                key={e.equipment_id}
                onClick={() => router.push(`/inspect?eq=${encodeURIComponent(e.equipment_id)}`)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i ? "1px solid var(--bd)" : "none", gap: 10, cursor: "pointer" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.equipment_id} · {e.equipment_name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 2 }}>
                    {e.floor}/{e.zone} · {e.category} · {e.location_id}
                  </div>
                </div>
                <Pill label={e.qr_status === "ASSIGNED" ? "부착완료" : "부착대기"} />
              </div>
            ))}
          </div>
        )}
      </div>
    </Chrome>
  );
}
