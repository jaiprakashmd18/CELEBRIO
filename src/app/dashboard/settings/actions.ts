"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ displayName: z.string().trim().max(80) });

export async function updateProfile(_prev: { message: string } | null, formData: FormData) {
  const user = await requireUser("/dashboard/settings");
  const parsed = schema.safeParse({ displayName: formData.get("displayName") ?? "" });
  if (!parsed.success) return { message: "Names can be up to 80 characters." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data.displayName || null }).eq("id", user.id);
  if (error) return { message: "Couldn't save. Please try again." };
  revalidatePath("/dashboard");
  return { message: "Saved." };
}
