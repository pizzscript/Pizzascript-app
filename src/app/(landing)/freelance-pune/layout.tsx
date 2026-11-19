import { ScrollProvider } from "@/components/motion/ScrollProvider";
import "@/styles/freelance-pune.css";
import "@/styles/whatsapp-ball.css";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScrollProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {children}
    </ScrollProvider>
  );
}
