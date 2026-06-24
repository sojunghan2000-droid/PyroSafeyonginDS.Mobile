"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function Icon({ name, on }: { name: string; on: boolean }) {
  const c = on ? "var(--brand)" : "var(--hint)";
  const p: Record<string, string> = {
    home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
    inspect: "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 9h16M8 3v3M16 3v3M9 14l2 2 4-4",
    check: "M9 11l3 3 8-8M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={p[name]} />
    </svg>
  );
}

export default function Chrome({
  title, active, back, children,
}: { title?: string; active?: "home" | "inspect" | "check"; back?: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [name, setName] = useState("");

  useEffect(() => {
    fetch("/api/me").then((r) => (r.ok ? r.json() : null)).then((d) => d?.user && setName(d.user.name)).catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="shell">
      <header style={{ background: "var(--white)", borderBottom: "1px solid var(--bd)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 20 }}>
        <span style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>PyroSafe</span>
        <button onClick={logout} style={{ fontSize: 13, color: "var(--sub)", background: "none", border: "none", cursor: "pointer" }}>
          {name || "사용자"} ▾
        </button>
      </header>

      {title && (
        <div style={{ background: "var(--white)", borderBottom: "1px solid var(--bd)", padding: "13px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          {back && (
            <button onClick={() => router.back()} aria-label="뒤로" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)", fontSize: 18, lineHeight: 1 }}>←</button>
          )}
          <span style={{ fontWeight: 600, fontSize: 16 }}>{title}</span>
        </div>
      )}

      <main style={{ flex: 1, padding: "16px", paddingBottom: active ? 84 : 16 }}>{children}</main>

      {active && (
        <nav style={{ position: "sticky", bottom: 0, background: "var(--white)", borderTop: "1px solid var(--bd)", display: "flex", padding: "8px 0 14px" }}>
          {([["home", "홈", "/"], ["inspect", "오늘점검", "/inspection"], ["check", "조치", "/actions"]] as const).map(([k, label, href]) => (
            <button key={k} onClick={() => router.push(href)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer" }}>
              <Icon name={k} on={active === k} />
              <span style={{ fontSize: 11, color: active === k ? "var(--brand-tx)" : "var(--sub)", fontWeight: active === k ? 500 : 400 }}>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
