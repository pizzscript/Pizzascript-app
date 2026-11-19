import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { HeroSection } from "@/components/home/HeroSection";
import { MenuSection } from "@/components/home/MenuSection";
import { OrderSection } from "@/components/home/OrderSection";
import { PortfolioSection } from "@/components/home/PortfolioSection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { SectionNav } from "@/components/home/SectionNav";
import { AromaSection, BakingSection, DoughSection, RemovingSection, ToppingsSection } from "@/components/home/sequences";

export const metadata: Metadata = {
  ...pageMetadata({ title: "PizzaScript — Hand-Crafted Websites, Made from Scratch", description: "PizzaScript is a Pune web engineering studio building custom websites, web apps and technical SEO from scratch. Fast, accessible, zero templates.", path: "/" }),
  title: { absolute: "PizzaScript — Hand-Crafted Websites, Made from Scratch" },
};

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <MenuSection />
      <DoughSection />
      <ToppingsSection />
      <BakingSection />
      <RemovingSection />
      <AromaSection />
      <PortfolioSection />
      <ReviewsSection />
      <OrderSection />
      <SectionNav />
    </>
  );
}
