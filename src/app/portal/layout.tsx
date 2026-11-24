import type { Metadata } from "next";
import "@/styles/studio.css";

export const metadata: Metadata = {
  title: { default: "Client portal", template: "%s · Client portal" },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio min-h-screen">{children}</div>;
}
