export const SITE = {
  name: "PizzaScript",
  url: "https://www.pizzascript.com",
  tagline: "Hand-crafted websites, made from scratch.",
  description:
    "PizzaScript is a web engineering studio in Pune building custom websites, web apps and technical SEO from scratch. Fast, accessible, no templates.",
  email: "pizzzascript@gmail.com",
  phone: "+919356636203",
  phoneDisplay: "+91 93566 36203",
  whatsappUrl: "https://wa.me/919356636203",
  githubUrl: "https://github.com/pizzascript",
  mapsUrl: "https://maps.app.goo.gl/8d6HJiHh8656Dsyj6",
  formspreeEndpoint: "https://formspree.io/f/xaqvrewo",
  framesBaseUrl:
    process.env.NEXT_PUBLIC_FRAMES_BASE_URL ?? "https://pub-60e443554d0643d5be3dba979f62b323.r2.dev",
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
] as const;

export function absoluteUrl(path: string) {
  return new URL(path, SITE.url).toString();
}
