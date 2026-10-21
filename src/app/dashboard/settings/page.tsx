import { DeleteAccountForm, ProfileForm } from "@/components/forms/settings-forms";
import { Card } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return (
    <div className="space-y-8">
      <h1 className="font-serif text-4xl">Settings</h1>
      <Card className="p-6">
        <h2 className="font-serif text-2xl">Profile</h2>
        <p className="mt-1 text-sm text-gray">Signed in as {user.email}.</p>
        <div className="mt-5 max-w-md"><ProfileForm displayName={profile?.display_name ?? ""} /></div>
      </Card>
      <Card className="p-6">
        <h2 className="font-serif text-2xl">Password</h2>
        <p className="mt-1 text-sm text-gray">To change your password, we&apos;ll email you a secure link.</p>
        <a href="/forgot-password" className="mt-4 inline-block text-sm underline">Send a password reset link</a>
      </Card>
      <Card className="p-6 ring-danger/30">
        <h2 className="font-serif text-2xl text-danger">Delete account</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray">This permanently deletes your profile, drafts, uploaded photos and generated files. Purchase records are kept for accounting and tax purposes but are disconnected from your account. This can&apos;t be undone.</p>
        <div className="mt-5 max-w-md"><DeleteAccountForm /></div>
      </Card>
    </div>
  );
}
