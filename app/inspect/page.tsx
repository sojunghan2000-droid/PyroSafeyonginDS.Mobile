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

  function toggleType(t: string) {
    setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  }

  async function save() {
    if (!result) { setToast("점검 결과를 선택해 주세요."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } finally {
      setBusy(false);
    }
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
