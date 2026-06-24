"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "로그인 실패"); return; }
      router.replace("/");
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell" style={{ justifyContent: "center", background: "var(--white)" }}>
      <form onSubmit={submit} style={{ padding: "0 28px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--brand)" }}>PyroSafe</div>
          <div style={{ fontSize: 13, color: "var(--sub)", marginTop: 6 }}>현장 소방점검 · 모바일</div>
        </div>
        <input value={username} onChange={(e) => setU(e.target.value)} placeholder="아이디" autoCapitalize="none" style={{ padding: "13px 14px", fontSize: 15 }} />
        <input value={password} onChange={(e) => setP(e.target.value)} placeholder="비밀번호" type="password" style={{ padding: "13px 14px", fontSize: 15 }} />
        {err && <div style={{ color: "var(--bad)", fontSize: 13 }}>{err}</div>}
        <button type="submit" disabled={busy} className="btn-primary" style={{ padding: "15px", fontSize: 16, border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
