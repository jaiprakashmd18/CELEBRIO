"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="font-serif text-5xl text-rose/70">Oops</p>
      <h1 className="mt-4 font-serif text-3xl">Something went wrong on our side</h1>
      <p className="mt-3 text-gray">Your saved work is safe. Please try again — if it keeps happening, contact support{error.digest ? ` and mention reference ${error.digest}` : ""}.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className="h-11 rounded-full bg-charcoal px-5 font-medium text-ivory">Try again</button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full px-5 ring-1 ring-line">Go home</Link>
      </div>
    </main>
  );
}
