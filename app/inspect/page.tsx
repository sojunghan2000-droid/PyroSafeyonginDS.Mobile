"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Chrome from "@/components/Chrome";
import { Pill, Spinner, Toast } from "@/components/ui";

const TYPES = ["임시소방시설", "피난로 등", "화기취급감독", "화기작업구간 점검", "가설컨테이너 사무실 점검"];
const CONTAINER_TYPE = "가설컨테이너 사무실 점검";
type Result = "양호" | "불량" | "오동작";
type OpenTask = { task_id: string; round_id: string; task_type: string; due_date: string; status: string };

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
  const [discFile, setDiscFile] = useState<File | null>(null);
  const [discFile2, setDiscFile2] = useState<File | null>(null);
  const [openTasks, setOpenTasks] = useState<OpenTask[]>([]);
  const [matchedTaskId, setMatchedTaskId] = useState<string | null>(null);
  const isContainer = types.includes(CONTAINER_TYPE);

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
      const tasks: OpenTask[] = d.openTasks || [];
      setOpenTasks(tasks);
      if (tasks.length === 1) setMatchedTaskId(tasks[0].task_id);
    }).catch(() => setErr("네트워크 오류"));
  }, [eq, taskId, isTask]);

  function toggleType(t: string) {
    setTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  }

  async function uploadPhoto(f: File, id: string): Promise<string> {
    const fd = new FormData();
    fd.append("file", f); fd.append("id", id);
    const up = await fetch("/api/upload", { method: "POST", body: fd });
    const ud = await up.json();
    if (!up.ok) throw new Error(ud.error || "사진 업로드 실패");
    return ud.path;
  }

  async function save() {
    if (!result) { setToast("점검 결과를 선택해 주세요."); return; }
    if (!isTask && result === "불량" && isContainer && !discFile) {
      setToast("가설컨테이너 사무실 점검은 조치 전 사진이 필수입니다.");
      return;
    }
    setBusy(true);
    try {
      let photoPath: string | undefined;
      let photoPath2: string | undefined;
      if (!isTask && result === "불량") {
        try {
          if (discFile) photoPath = await uploadPhoto(discFile, `${eq}-disc`);
          if (discFile2) photoPath2 = await uploadPhoto(discFile2, `${eq}-disc2`);
        } catch (e: any) { setToast(e.message || "사진 업로드 실패"); return; }
      }
      const r = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentId: isTask ? undefined : eq, taskId: isTask ? taskId : undefined,
          result, inspectionTypes: types, issue, malfunctionDetail: malDetail,
          immediate: showImmediate && imNote.trim() ? { note: imNote, confirmer: imConfirmer } : null,
          photoPath, photoPath2,
          matchedTaskId: !isTask ? matchedTaskId : undefined,
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

        {!isTask && openTasks.length >= 2 && (
          <div>
            <div style={{ fontSize: 12, color: "var(--sub)", fontWeight: 500, marginBottom: 6 }}>어느 회차 점검인가요?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {openTasks.map((t) => (
                <label key={t.task_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: `1px solid ${matchedTaskId === t.task_id ? "var(--brand)" : "var(--bd)"}`, borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" checked={matchedTaskId === t.task_id} onChange={() => setMatchedTaskId(t.task_id)} />
                  {t.round_id} · {t.task_type} · 마감 {t.due_date}
                </label>
              ))}
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: `1px solid ${matchedTaskId === null ? "var(--brand)" : "var(--bd)"}`, borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={matchedTaskId === null} onChange={() => setMatchedTaskId(null)} />
                — 회차 미연결 (단독 기록) —
              </label>
            </div>
          </div>
        )}
        {!isTask && openTasks.length === 1 && (
          <div style={{ fontSize: 12, color: "var(--sub)" }}>
            🔗 이 점검은 {openTasks[0].round_id}({openTasks[0].task_type}) 회차에 연결됩니다.
          </div>
        )}

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

        {result === "불량" && !isTask && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--sub)", fontWeight: 500 }}>
              조치 전 사진{isContainer ? " (필수)" : " (선택)"}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--sub)" }}>
              <span style={{ padding: "8px 12px", border: "1px solid var(--bd)", borderRadius: 8, background: "var(--white)", cursor: "pointer", whiteSpace: "nowrap" }}>📷 사진 선택</span>
              <input type="file" accept="image/*" capture="environment" onChange={(e) => setDiscFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{discFile ? discFile.name : "선택 안 함"}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--sub)" }}>
              <span style={{ padding: "8px 12px", border: "1px solid var(--bd)", borderRadius: 8, background: "var(--white)", cursor: "pointer", whiteSpace: "nowrap" }}>📷 사진 선택 2</span>
              <input type="file" accept="image/*" capture="environment" onChange={(e) => setDiscFile2(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{discFile2 ? discFile2.name : "선택 안 함 (선택)"}</span>
            </label>
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
