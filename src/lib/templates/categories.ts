/** The eight occasion categories. Seeded into the database; slugs are stable URLs. */
export const CATEGORIES = [
  { slug: "birthday", name: "Birthday", description: "Playful and elegant invitations for every birthday, from first to fiftieth.", displayOrder: 1 },
  { slug: "anniversary", name: "Anniversary", description: "Celebrate years of love with romantic and refined anniversary invitations.", displayOrder: 2 },
  { slug: "wedding", name: "Wedding", description: "Timeless wedding invitations for ceremonies, receptions and everything in between.", displayOrder: 3 },
  { slug: "engagement", name: "Engagement", description: "Share the big news with photo-led and botanical engagement invitations.", displayOrder: 4 },
  { slug: "graduation", name: "Graduation", description: "Bold and editorial designs to celebrate the class of this year.", displayOrder: 5 },
  { slug: "baby-shower", name: "Baby Shower", description: "Soft, sweet invitations to welcome the newest little one.", displayOrder: 6 },
  { slug: "party", name: "Party", description: "From neon nights to sunny brunches — invitations for every kind of party.", displayOrder: 7 },
  { slug: "other", name: "Other Occasions", description: "Save the dates, thank-you cards and versatile designs for any celebration.", displayOrder: 8 },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORIES.some((c) => c.slug === value);
}
