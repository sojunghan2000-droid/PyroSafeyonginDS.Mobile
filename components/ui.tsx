"use client";
import React from "react";

export const RESULT_STYLE: Record<string, { bg: string; tx: string }> = {
  양호: { bg: "var(--ok-bg)", tx: "var(--ok-tx)" },
  불량: { bg: "var(--bad-bg)", tx: "var(--bad-tx)" },
  오동작: { bg: "var(--warn-bg)", tx: "var(--warn-tx)" },
  "조치 대기": { bg: "var(--bad-bg)", tx: "var(--bad-tx)" },
  "조치 완료": { bg: "var(--ok-bg)", tx: "var(--ok-tx)" },
  완료: { bg: "var(--ok-bg)", tx: "var(--ok-tx)" },
};

export function Pill({ label }: { label: string }) {
  const s = RESULT_STYLE[label] ?? { bg: "var(--brand-bg)", tx: "var(--brand-tx)" };
  return (
    <span style={{ background: s.bg, color: s.tx, fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

export function Toast({ msg, type = "ok" }: { msg: string; type?: "ok" | "bad" }) {
  if (!msg) return null;
  const bg = type === "ok" ? "var(--ink)" : "var(--bad)";
  return (
    <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 88, background: bg, color: "#fff", fontSize: 13, padding: "10px 16px", borderRadius: 10, zIndex: 50, maxWidth: 380, textAlign: "center", boxShadow: "0 6px 20px rgba(0,0,0,.18)" }}>
      {msg}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "32px 0", color: "var(--hint)", fontSize: 13 }}>
      불러오는 중…
    </div>
  );
}
