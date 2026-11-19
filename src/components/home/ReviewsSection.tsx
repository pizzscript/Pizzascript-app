import { TESTIMONIALS } from "@/data/testimonials";

export function ReviewsSection() {
  return (
    <section id="reviews" className="section" aria-labelledby="reviews-title">
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "64px" }}>
          <p className="cin-eyebrow" style={{ justifyContent: "center" }}>
            <span aria-hidden="true" style={{ width: 32, height: 1, background: "var(--color-oven-orange)", display: "inline-block" }} />
            Testimonials
          </p>
          <h2 id="reviews-title" className="section-title" data-animate="fade-up">
            Happy Customers
          </h2>
          <p className="section-subtitle" data-animate="fade-up" data-animate-delay="1">
            Don&apos;t take our word for it. Read the reviews.
          </p>
        </div>

        <div className="testimonials-grid" data-animate="fade-up" data-animate-delay="2">
          {TESTIMONIALS.map((t) => (
            <figure key={t.author} className="testimonial-card">
              <div className="testimonial-card__quote-mark" aria-hidden="true">
                &ldquo;
              </div>
              <blockquote>
                <p className="testimonial-card__text">{t.quote}</p>
              </blockquote>
              {t.rating && (
                <div className="testimonial-card__rating" role="img" aria-label={`Rated ${t.rating} out of 5`}>
                  {"★".repeat(t.rating)}
                </div>
              )}
              <figcaption className="testimonial-card__author">
                <span className="testimonial-card__name">{t.author}</span>
                <span className="testimonial-card__date">{t.date}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
