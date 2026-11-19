import type { MetadataRoute } from "next";
import { CASE_STUDIES } from "@/data/portfolio";
import { SERVICES } from "@/data/services";
import { getPublishedPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts();

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
    { url: absoluteUrl("/services"), changeFrequency: "monthly", priority: 0.9 },
    ...SERVICES.map((service) => ({
      url: absoluteUrl(`/services/${service.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: absoluteUrl("/portfolio"), changeFrequency: "monthly", priority: 0.8 },
    ...CASE_STUDIES.map((study) => ({
      url: absoluteUrl(`/portfolio/${study.slug}`),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/about"), changeFrequency: "yearly", priority: 0.6 },
    { url: absoluteUrl("/freelance-pune"), changeFrequency: "monthly", priority: 0.7 },
    {
      url: absoluteUrl("/blog"),
      lastModified: posts[0]?.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return pages;
}
