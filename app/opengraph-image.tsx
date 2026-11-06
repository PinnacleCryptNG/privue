import { ImageResponse } from "next/og";

export const alt = "Privue: sell the view, keep the trades";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [62, 48, 70, 54];

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0c0e13", color: "#e8eaf0", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="56" height="56" viewBox="0 0 32 32">
              <rect x="1" y="1" width="30" height="30" rx="9" fill="#b8c4ff" />
              <rect x="7" y="7" width="18" height="18" rx="5" fill="#0c0e13" />
              <rect x="7" y="14" width="18" height="4" fill="#b8c4ff" />
              <circle cx="20.5" cy="16" r="1.4" fill="#0c0e13" />
            </svg>
            <span style={{ fontSize: 40, fontWeight: 700 }}>Privue</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>Sell the view.</span>
            <span style={{ color: "#b8c4ff" }}>Keep the trades.</span>
          </div>
          <span style={{ fontSize: 28, color: "#8b91a3" }}>Private copy trading on NEAR Intents</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: 380, justifyContent: "center", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
            <span>Atlas</span>
            <span style={{ color: "#5fd59a" }}>verified record</span>
          </div>
          {ROWS.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "18px 20px", borderRadius: 14, background: "#151821", border: "1px solid #232735" }}>
              <div style={{ width: 54, height: 16, borderRadius: 8, background: i % 2 ? "#5a2f3a" : "#24533f" }} />
              <div style={{ width: `${w}%`, height: 16, borderRadius: 8, background: "#2a2f40" }} />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
