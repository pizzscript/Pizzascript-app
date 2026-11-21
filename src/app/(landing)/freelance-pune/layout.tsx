import { ScrollProvider } from "@/components/motion/ScrollProvider";
import { SiteAnalytics } from "@/components/site/SiteAnalytics";
import "@/styles/freelance-pune.css";
import "@/styles/whatsapp-ball.css";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScrollProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {children}
      <SiteAnalytics />
    </ScrollProvider>
  );
}
