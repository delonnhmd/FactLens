import { ImageResponse } from "next/og";

export const alt = "FactFight community-powered claim verification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#0F172A",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "950px" }}>
          <div style={{ color: "#A5B4FC", display: "flex", fontSize: 28, marginBottom: 30 }}>
            Community-powered verification
          </div>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 500, letterSpacing: "-4px" }}>
            FactFight
          </div>
          <div style={{ color: "#CBD5E1", display: "flex", fontSize: 42, lineHeight: 1.25, marginTop: 24 }}>
            Fight misinformation, not each other.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
