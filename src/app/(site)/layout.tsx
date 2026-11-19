import { RevealObserver } from "@/components/motion/RevealObserver";
import { ScrollProvider } from "@/components/motion/ScrollProvider";
import { Footer } from "@/components/site/Footer";
import { MatrixBackground } from "@/components/site/MatrixBackground";
import { Navbar } from "@/components/site/Navbar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScrollProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <MatrixBackground />
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <RevealObserver />
    </ScrollProvider>
  );
}
