import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";
import "@/styles/studio.css";

export const instant = false;

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0604",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={fontVariables}>
      <body>
        <div className="studio">{children}</div>
      </body>
    </html>
  );
}
