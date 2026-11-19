import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "PizzaScript — hand-crafted websites, made from scratch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const pizza = await readFile(join(process.cwd(), "assets/og-pizza.png"));
const pizzaSrc = `data:image/png;base64,${pizza.toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 96px",
          gap: 64,
          background: "radial-gradient(circle at 75% 40%, #3D2517 0%, #0B0604 65%)",
          color: "#FFF8F0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse only supports <img>. */}
        <img src={pizzaSrc} width={256} height={256} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", color: "#E87040" }}>
            Web Engineering Studio · Pune
          </div>
          <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1 }}>PizzaScript</div>
          <div style={{ fontSize: 38, color: "#C4A882", maxWidth: 640 }}>Hand-crafted websites, made from scratch.</div>
        </div>
      </div>
    ),
    size,
  );
}
