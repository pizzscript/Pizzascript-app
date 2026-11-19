import type { Metadata } from "next";
import "@/styles/studio.css";

export const instant = false;

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio">{children}</div>;
}
