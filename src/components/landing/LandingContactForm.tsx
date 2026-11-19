"use client";

import { BUDGET, PROJECT_TYPES, useContactForm } from "@/hooks/useContactForm";
import { SITE } from "@/lib/site";

const ERRORS = {
  name: "Every inquiry needs a name.",
  email: "A valid email is required.",
  projectType: "Please select a service.",
} as const;

export function LandingContactForm() {
  const { values, set, blur, fieldState, errors, submit, submitting, status, formRef, budgetLabel } = useContactForm();

  const groupClass = (field: keyof typeof ERRORS) => {
    const state = fieldState(field);
    return `fp-form-group${state === "error" ? " fp-form-error-state" : state === "valid" ? " fp-form-valid-state" : ""}`;
  };
  const a11y = (field: keyof typeof ERRORS) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `fp-error-${field}` : undefined,
    "data-field": field,
  });
  const error = (field: keyof typeof ERRORS) =>
    errors[field] ? (
      <span className="fp-form-error-msg" id={`fp-error-${field}`} role="alert">
        {ERRORS[field]}
      </span>
    ) : null;

  return (
    <div className="fp-contact-form-wrap fp-reveal">
      <form ref={formRef} className="fp-contact-form" onSubmit={submit} noValidate>
        <div className="fp-form-row">
          <div className={groupClass("name")}>
            <label htmlFor="fp-customer-name" className="fp-form-label">
              Your Name <span className="fp-form-required" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              id="fp-customer-name"
              name="customer_name"
              className="fp-form-input"
              placeholder="What should we call you?"
              autoComplete="name"
              required
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              onBlur={() => blur("name")}
              {...a11y("name")}
            />
            {error("name")}
          </div>
          <div className={groupClass("email")}>
            <label htmlFor="fp-customer-email" className="fp-form-label">
              Your Email <span className="fp-form-required" aria-hidden="true">*</span>
            </label>
            <input
              type="email"
              id="fp-customer-email"
              name="email"
              className="fp-form-input"
              placeholder="Where should we reply?"
              autoComplete="email"
              required
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              onBlur={() => blur("email")}
              {...a11y("email")}
            />
            {error("email")}
          </div>
        </div>

        <div className="fp-form-row">
          <div className="fp-form-group">
            <label htmlFor="fp-customer-phone" className="fp-form-label">
              Contact Number
            </label>
            <input
              type="tel"
              id="fp-customer-phone"
              name="phone"
              className="fp-form-input"
              placeholder="Your WhatsApp / mobile number"
              autoComplete="tel"
              inputMode="tel"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className={groupClass("projectType")}>
            <label htmlFor="fp-project-type" className="fp-form-label">
              Service Needed <span className="fp-form-required" aria-hidden="true">*</span>
            </label>
            <select
              id="fp-project-type"
              name="project_type"
              className="fp-form-select"
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
            {error("projectType")}
          </div>
        </div>

        <div className="fp-form-group">
          <label htmlFor="fp-budget" className="fp-form-label">
            Budget Range <span className="fp-form-budget-display">{budgetLabel}</span>
          </label>
          <input
            type="range"
            id="fp-budget"
            name="budget"
            className="fp-form-range"
            min={BUDGET.min}
            max={BUDGET.max}
            step={BUDGET.step}
            value={values.budget}
            aria-valuetext={budgetLabel}
            onChange={(e) => set("budget", Number(e.target.value))}
          />
          <div className="fp-form-range-labels" aria-hidden="true">
            <span>₹5,000</span>
            <span>₹50,000+</span>
          </div>
        </div>

        <div className="fp-form-group">
          <label htmlFor="fp-details" className="fp-form-label">
            Project Details
          </label>
          <textarea
            id="fp-details"
            name="details"
            className="fp-form-textarea"
            placeholder="Tell us about your project — goals, features, timeline, any references..."
            rows={5}
            value={values.details}
            onChange={(e) => set("details", e.target.value)}
          />
        </div>

        <div className="visually-hidden-field" aria-hidden="true">
          <label htmlFor="fp-gotcha">Leave this field empty</label>
          <input type="text" id="fp-gotcha" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="fp-form-footer">
          <button type="submit" className="fp-btn-primary fp-form-submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send Project Inquiry"}
          </button>
          <div className="fp-form-alt-contact">
            <a href={SITE.whatsappUrl} target="_blank" rel="noopener noreferrer" className="fp-btn-secondary">
              Chat on WhatsApp
            </a>
          </div>
        </div>

        <div role="status" aria-live="polite">
          {status && <div className={`fp-form-message fp-form-message--${status.type}`}>{status.text}</div>}
        </div>
      </form>
    </div>
  );
}
