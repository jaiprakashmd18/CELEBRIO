"use client";

import { useEffect, useState } from "react";
import { CONSENT_KEY } from "./cookie-notice";

export function CookieSettings() {
  const [analytics, setAnalytics] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CONSENT_KEY);
      if (raw) setAnalytics(Boolean(JSON.parse(raw).analytics));
    } catch {}
  }, []);
  return (
    <div className="not-prose mt-6 rounded-2xl bg-white p-5 ring-1 ring-line">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-charcoal">Strictly necessary</p>
          <p className="text-sm text-gray">Always on</p>
        </div>
        <span className="rounded-full bg-sand px-3 py-1 text-xs">Required</span>
      </div>
      <hr className="my-4 border-line" />
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block font-medium text-charcoal">Privacy-friendly analytics</span>
          <span className="block text-sm text-gray">Not currently in use. Off by default.</span>
        </span>
        <input type="checkbox" className="size-5 accent-charcoal" checked={analytics} onChange={(e) => { setAnalytics(e.target.checked); setSaved(false); }} />
      </label>
      <button
        type="button"
        className="mt-5 h-10 rounded-full bg-charcoal px-5 text-sm font-medium text-ivory"
        onClick={() => {
          try {
            window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ acknowledged: true, analytics, at: new Date().toISOString() }));
            setSaved(true);
          } catch {}
        }}
      >
        Save preferences
      </button>
      {saved && <p role="status" className="mt-2 text-sm text-success">Preferences saved.</p>}
    </div>
  );
}
