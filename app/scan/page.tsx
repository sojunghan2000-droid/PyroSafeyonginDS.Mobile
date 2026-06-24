"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Chrome from "@/components/Chrome";

function extractEq(text: string): string {
  try {
    const u = new URL(text);
    const eq = u.searchParams.get("eq");
    if (eq) return eq;
  } catch {}
  return text.trim();
}

export default function Scan() {
  const router = useRouter();
  const ref = useRef<any>(null);
  const [manual, setManual] = useState("");
  const [camErr, setCamErr] = useState(false);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const inst = new Html5Qrcode("reader", { verbose: false } as any);
        ref.current = inst;
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 200, height: 200 } },
          (decoded: string) => {
            if (stopped) return;
            stopped = true;
            try { inst.stop().catch(() => {}); } catch {}
            router.push(`/inspect?eq=${encodeURIComponent(extractEq(decoded))}`);
          },
          () => {}
        );
      } catch {
        setCamErr(true);
      }
    })();
    return () => {
      stopped = true;
      try {
        const st = ref.current?.getState?.();
        // 2 = SCANNING (html5-qrcode). 시작 안 됐으면 stop() 호출 안 함.
        if (ref.current && st === 2) ref.current.stop().catch(() => {});
      } catch {}
    };
  }, [router]);

  function go() {
    if (manual.trim()) router.push(`/inspect?eq=${encodeURIComponent(extractEq(manual))}`);
  }

  return (
    <Chrome title="QR 스캔" active="inspect" back>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div id="reader" style={{ width: "100%", maxWidth: 340, aspectRatio: "1", background: "var(--dark)", borderRadius: 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {camErr && (
            <div style={{ width: 170, height: 170, border: "3px solid #fff", borderRadius: 14 }} />
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--sub)" }}>
          {camErr ? "카메라를 사용할 수 없습니다 — ID로 진입하세요" : "QR을 사각형 안에 맞춰주세요"}
        </div>
        <div style={{ width: "100%", maxWidth: 340, display: "flex", gap: 8 }}>
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="장비 ID 직접 입력 (예: EQ-0006)" style={{ flex: 1, padding: "12px 14px", fontSize: 14 }} onKeyDown={(e) => e.key === "Enter" && go()} />
          <button onClick={go} style={{ padding: "0 18px", background: "var(--white)", border: "1px solid var(--bd)", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "var(--ink)", cursor: "pointer" }}>이동</button>
        </div>
      </div>
    </Chrome>
  );
}
