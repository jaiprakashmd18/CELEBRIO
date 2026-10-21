/**
 * The 16 original starter templates. They are inserted into the database by
 * supabase/seed.sql (generated with `npm run db:seed:generate`) and are also
 * used as a read-only catalogue when Supabase is not configured locally.
 */
import { goldenYears, ourStory } from "./anniversary";
import { littleBloom, littleStar } from "./baby-shower";
import { midnightCelebration, peachConfetti } from "./birthday";
import { gardenRomance, theYesMoment } from "./engagement";
import { classOfTomorrow, newChapter } from "./graduation";
import type { StarterTemplate } from "./helpers";
import { saveTheDate, thankYouCelebrate } from "./other";
import { neonNight, sundayBrunch } from "./party";
import { ivoryBotanicals, modernElegance } from "./wedding";

export const STARTER_TEMPLATES: StarterTemplate[] = [
  peachConfetti,
  midnightCelebration,
  ourStory,
  goldenYears,
  ivoryBotanicals,
  modernElegance,
  theYesMoment,
  gardenRomance,
  newChapter,
  classOfTomorrow,
  littleBloom,
  littleStar,
  neonNight,
  sundayBrunch,
  saveTheDate,
  thankYouCelebrate,
];

export type { StarterTemplate };
