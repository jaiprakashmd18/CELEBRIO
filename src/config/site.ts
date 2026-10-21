export const siteConfig = {
  name: "Celebrio",
  tagline: "Make Every Moment Beautiful.",
  description:
    "Create personalised digital invitations for birthdays, anniversaries, weddings, engagements, graduations, baby showers and parties. Choose a design, add your photos and words, and download beautiful files.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
  /** Business details shown in legal pages. The owner must replace these before launch. */
  legalEntity: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME ?? "[Your business name]",
  refundWindowDays: 7,
} as const;
