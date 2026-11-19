import { Geist, Inter, JetBrains_Mono, Playfair_Display, Press_Start_2P, VT323 } from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

export const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap", preload: false });

export const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
  display: "swap",
  preload: false,
});

export const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
  display: "swap",
  preload: false,
});

export const fontVariables = [inter, playfair, jetbrainsMono, geist, pressStart, vt323]
  .map((font) => font.variable)
  .join(" ");
