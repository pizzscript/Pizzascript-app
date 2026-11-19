import { cacheLife } from "next/cache";
import Link from "next/link";
import { NAV_LINKS, SITE } from "@/lib/site";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function Footer() {
  return (
    <footer id="the-bill" className="footer">
      <div className="container">
        <div className="receipt">
          <div className="receipt-header">
            <div className="receipt-logo">Pizza Script</div>
            <p className="receipt-tagline">Hand-crafted websites. Made from scratch.</p>
          </div>

          <dl className="receipt-items">
            {[
              ["Subtotal", "One amazing website"],
              ["Tax", "Zero hidden fees"],
              ["Tip", "Appreciated but optional"],
              ["Total", "A happy client"],
            ].map(([label, value]) => (
              <div className="receipt-item" key={label}>
                <dt className="receipt-item-label">{label}</dt>
                <dd className="receipt-item-value">{value}</dd>
              </div>
            ))}
          </dl>

          <nav className="receipt-social" aria-label="Footer">
            <ul className="social-links" style={{ marginBottom: 16 }}>
              {NAV_LINKS.filter((link) => link.href !== "/").map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="social-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="receipt-social-label">Get In Touch:</p>
            <ul className="social-links">
              <li>
                <a href={`mailto:${SITE.email}`} className="social-link">
                  Email
                </a>
              </li>
              <li>
                <a href={`tel:${SITE.phone}`} className="social-link" aria-label={`Call ${SITE.phoneDisplay}`}>
                  Call Us
                </a>
              </li>
              <li>
                <a href={SITE.whatsappUrl} target="_blank" rel="noopener noreferrer" className="social-link">
                  WhatsApp
                </a>
              </li>
            </ul>
          </nav>

          <p className="receipt-copyright">
            © <CopyrightYear /> Pizza Script · Pune, India
          </p>
        </div>
      </div>
    </footer>
  );
}
