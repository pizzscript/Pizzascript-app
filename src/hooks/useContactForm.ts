"use client";

import { useRef, useState } from "react";
import { SITE } from "@/lib/site";

export const PROJECT_TYPES = [
  "Landing Page",
  "Full Website",
  "Web Application",
  "UI/UX Design",
  "SEO Optimization",
  "Bug Fix / Small Task",
] as const;

export const BUDGET = { min: 5000, max: 50000, step: 5000, initial: 15000 } as const;

type RequiredField = "name" | "email" | "projectType";

interface Values {
  name: string;
  email: string;
  phone: string;
  projectType: string;
  budget: number;
  details: string;
}

const INITIAL: Values = { name: "", email: "", phone: "", projectType: "", budget: BUDGET.initial, details: "" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(field: RequiredField, values: Values) {
  if (field === "name") return values.name.trim().length >= 2;
  if (field === "email") return EMAIL.test(values.email.trim());
  return values.projectType !== "";
}

export function useContactForm() {
  const [values, setValues] = useState<Values>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<RequiredField, boolean>>>({});
  const [touched, setTouched] = useState<Partial<Record<RequiredField, boolean>>>({});
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof Values>(field: K, value: Values[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (errors[field as RequiredField] !== undefined) {
      setErrors((e) => ({ ...e, [field]: !validate(field as RequiredField, next) }));
    }
  };

  const blur = (field: RequiredField) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: !validate(field, values) }));
  };

  const fieldState = (field: RequiredField) => {
    if (errors[field]) return "error" as const;
    if (touched[field] && validate(field, values)) return "valid" as const;
    return "idle" as const;
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fields: RequiredField[] = ["name", "email", "projectType"];
    const nextErrors = Object.fromEntries(fields.map((f) => [f, !validate(f, values)])) as Record<RequiredField, boolean>;
    setErrors(nextErrors);
    setTouched({ name: true, email: true, projectType: true });
    const firstInvalid = fields.find((f) => nextErrors[f]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${firstInvalid}"]`)?.focus();
      return;
    }

    const honeypot = new FormData(e.currentTarget).get("_gotcha");
    setSubmitting(true);
    setStatus(null);
    try {
      const body = new FormData();
      body.append("customer_name", values.name.trim());
      body.append("email", values.email.trim());
      body.append("phone", values.phone.trim());
      body.append("project_type", values.projectType);
      body.append("budget", `₹${values.budget.toLocaleString("en-IN")}${values.budget >= BUDGET.max ? "+" : ""}`);
      body.append("details", values.details.trim());
      body.append("_subject", `New ${values.projectType} enquiry from ${values.name.trim()}`);
      if (honeypot) body.append("_gotcha", String(honeypot));

      const response = await fetch(SITE.formspreeEndpoint, {
        method: "POST",
        body,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Formspree responded ${response.status}`);
      setStatus({
        type: "success",
        text: "Order received! We'll start preheating your project and reply within 24 hours.",
      });
      setValues(INITIAL);
      setErrors({});
      setTouched({});
    } catch {
      setStatus({
        type: "error",
        text: `Something went wrong sending your message. Please email us at ${SITE.email} or message us on WhatsApp.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const budgetLabel = `₹${values.budget.toLocaleString("en-IN")}${values.budget >= BUDGET.max ? "+" : ""}`;

  return { values, set, blur, fieldState, errors, submit, submitting, status, formRef, budgetLabel };
}
