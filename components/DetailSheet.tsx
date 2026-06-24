"use client";
import { useEffect, useState } from "react";
import { Pill, Spinner } from "@/components/ui";

type Sel = { kind: string; id: string } | null;

export default function DetailSheet({ sel, onClose }: { sel: Sel; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!sel) return;
    setData(null);
    setErr("");
    fetch(`/api/record/${sel.kind}/${encodeURIComponent(sel.id)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "오류");
        setData(d);
      })
      .catch((e) => setErr(e.message || "불러오지 못했습니다."));
  }, [sel]);

  if (!sel) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--white)", borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "85dvh", overflowY: "auto", padding: "10px 18px 28px" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 10px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--bd)" }} />
        </div>
        {err ? (
          <div style={{ padding: "24px 0", color: "var(--bad)", fontSize: 14, textAlign: "center" }}>{err}</div>
        ) : !data ? (
          <Spinner />
        ) : (
          <Body d={data} />
        )}
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
  if (bad)
    return <div style={{ marginTop: 8, padding: 14, border: "1px solid var(--bd)", borderRadius: 10, fontSize: 13, color: "var(--hint)", textAlign: "center" }}>사진을 불러올 수 없습니다</div>;
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
