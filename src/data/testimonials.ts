export interface Testimonial {
  quote: string;
  rating?: number;
  author: string;
  date: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Working with Pizza Script was smooth from start to finish. The communication was clear, timelines were respected, and the final website felt polished and thoughtfully built.",
    rating: 5,
    author: "Neeraj",
    date: "March 2026",
  },
  {
    quote:
      "We needed a clean, responsive website without unnecessary complexity, and Pizza Script delivered exactly that. Fast, professional, and easy to collaborate with.",
    rating: 5,
    author: "Ankita",
    date: "April 2026",
  },
  {
    quote:
      "What stood out most was the attention to detail. From mobile responsiveness to performance tweaks, everything felt carefully crafted rather than rushed.",
    rating: 4,
    author: "Ajinkya",
    date: "March 2026",
  },
  {
    quote:
      "Pizza Script made the technical side feel simple. Feedback was handled quickly, changes were implemented smoothly, and the overall experience felt reliable and professional.",
    author: "Sarrah",
    date: "February 2026",
  },
];
