import type { Metadata } from "next";
import { SITE } from "./site";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

const DEFAULT_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "PizzaScript — hand-crafted websites, made from scratch" };

/**
 * A page-level `openGraph` object replaces the inherited one entirely, so every page builds its
 * Open Graph data through this helper to keep the site name, locale and fallback image.
 */
export function pageMetadata({
  title,
  description,
  path,
  openGraph = {},
}: {
  title: string;
  description: string;
  path: string;
  openGraph?: OpenGraph;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      locale: "en_IN",
      title,
      description,
      url: path,
      images: [DEFAULT_IMAGE],
      ...openGraph,
    } as OpenGraph,
    twitter: { card: "summary_large_image", title, description },
  };
}
