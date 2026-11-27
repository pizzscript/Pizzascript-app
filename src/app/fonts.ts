import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/** Only for article titles in the editor and the brand mark: it previews how the article reads. */
export const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
  preload: false,
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

export const fontVariables = [inter, playfair, jetbrainsMono].map((font) => font.variable).join(" ");
