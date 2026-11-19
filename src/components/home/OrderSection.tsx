"use client";

import { BUDGET, PROJECT_TYPES, useContactForm } from "@/hooks/useContactForm";

const ERRORS = {
  name: "Every order needs a name.",
  email: "We need a valid email to send your order confirmation.",
  projectType: "Please select a service.",
} as const;

export function OrderSection() {
  const { values, set, blur, fieldState, errors, submit, submitting, status, formRef, budgetLabel } = useContactForm();

  const groupClass = (field: keyof typeof ERRORS) => {
    const state = fieldState(field);
    return `form-group${state === "error" ? " error" : state === "valid" ? " valid" : ""}`;
  };
  const a11y = (field: keyof typeof ERRORS) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `error-${field}` : undefined,
    "data-field": field,
  });

  return (
    <section id="order" className="section" aria-labelledby="order-title">
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <p className="cin-eyebrow" style={{ justifyContent: "center" }}>
            <span aria-hidden="true" style={{ width: 32, height: 1, background: "var(--color-oven-orange)", display: "inline-block" }} />
            Get in Touch
          </p>
          <h2 id="order-title" className="section-title" data-animate="fade-up">
            Place Your Order
          </h2>
          <p className="section-subtitle" data-animate="fade-up" data-animate-delay="1">
            Got a project craving? Let&apos;s cook up something fresh.
          </p>
        </div>

        <div className="order-pad" data-animate="fade-up" data-animate-delay="2">
          <form ref={formRef} onSubmit={submit} noValidate>
            <div className={groupClass("name")}>
              <label htmlFor="customer-name" className="form-label">
                Your Name
              </label>
              <input
                type="text"
                id="customer-name"
                name="customer_name"
                className="form-input"
                placeholder="What should we call you?"
                autoComplete="name"
                required
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => blur("name")}
                {...a11y("name")}
              />
              <span className="form-error" id="error-name" role="alert">
                {errors.name ? ERRORS.name : ""}
              </span>
            </div>

            <div className={groupClass("email")}>
              <label htmlFor="customer-email" className="form-label">
                Your Email
              </label>
              <input
                type="email"
                id="customer-email"
                name="email"
                className="form-input"
                placeholder="Where should we send the receipt?"
                autoComplete="email"
                required
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => blur("email")}
                {...a11y("email")}
              />
              <span className="form-error" id="error-email" role="alert">
                {errors.email ? ERRORS.email : ""}
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="customer-phone" className="form-label">
                Contact Number <span className="sr-only">(optional)</span>
              </label>
              <input
                type="tel"
                id="customer-phone"
                name="phone"
                className="form-input"
                placeholder="Your WhatsApp / mobile number"
                autoComplete="tel"
                inputMode="tel"
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>

            <div className={groupClass("projectType")}>
              <label htmlFor="project-type" className="form-label">
                What Are You Looking For?
              </label>
              <select
                id="project-type"
                name="project_type"
                className="form-select"
                required
                value={values.projectType}
                onChange={(e) => set("projectType", e.target.value)}
                onBlur={() => blur("projectType")}
                {...a11y("projectType")}
              >
                <option value="">Select a service...</option>
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <span className="form-error" id="error-projectType" role="alert">
                {errors.projectType ? ERRORS.projectType : ""}
              </span>
            </div>

            <div className="form-group range-group">
              <label htmlFor="budget" className="form-label">
                Budget Range
              </label>
              <div className="range-value" aria-hidden="true">
                {budgetLabel}
              </div>
              <input
                type="range"
                id="budget"
                name="budget"
                className="form-range"
                min={BUDGET.min}
                max={BUDGET.max}
                step={BUDGET.step}
                value={values.budget}
                aria-valuetext={budgetLabel}
                onChange={(e) => set("budget", Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="details" className="form-label">
                Project Details
              </label>
              <textarea
                id="details"
                name="details"
                className="form-textarea"
                placeholder="Tell us about your project — goals, features, timeline..."
                rows={5}
                value={values.details}
                onChange={(e) => set("details", e.target.value)}
              />
            </div>

            <div className="visually-hidden-field" aria-hidden="true">
              <label htmlFor="order-gotcha">Leave this field empty</label>
              <input type="text" id="order-gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="form-submit">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Sending..." : "Start the Conversation"}
              </button>
            </div>
          </form>

          <div role="status" aria-live="polite">
            {status && (
              <div className={`form-message ${status.type}`} style={{ display: "block" }}>
                {status.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
