"use client";

import { useId, useMemo, useState } from "react";
import { createProjectFromTemplate } from "@/lib/rendering/scene";
import type { TemplateDefinition } from "@/lib/templates/schema";
import { InvitationSvg } from "./invitation-svg";

interface Props {
  definition: TemplateDefinition;
  slug: string;
  version: number;
  nameFields: [string, string];
  templateName: string;
}

/** The homepage hero: a real starter template whose names visitors can edit live. */
export function HeroPreview({ definition, slug, version, nameFields, templateName }: Props) {
  const base = useMemo(() => createProjectFromTemplate(definition, { slug, version }), [definition, slug, version]);
  const [first, setFirst] = useState(base.fields[nameFields[0]] ?? "");
  const [second, setSecond] = useState(base.fields[nameFields[1]] ?? "");
  const id = useId();
  const project = useMemo(() => ({ ...base, fields: { ...base.fields, [nameFields[0]]: first, [nameFields[1]]: second } }), [base, first, second, nameFields]);

  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-rose/25 via-sand to-gold/25 blur-2xl" />
      <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-lift ring-1 ring-line">
        <InvitationSvg definition={definition} project={project} idPrefix="hero" title={`${templateName} invitation preview for ${first} and ${second}`} />
      </div>
      <div className="mt-5 rounded-2xl bg-white/90 p-4 shadow-soft ring-1 ring-line backdrop-blur">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray">Try it — type your names</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor={`${id}-a`}>First name</label>
          <input id={`${id}-a`} value={first} maxLength={20} onChange={(e) => setFirst(e.target.value)} className="h-10 rounded-xl border border-line px-3 text-sm focus:border-charcoal/40 focus:outline-none" />
          <label className="sr-only" htmlFor={`${id}-b`}>Second name</label>
          <input id={`${id}-b`} value={second} maxLength={20} onChange={(e) => setSecond(e.target.value)} className="h-10 rounded-xl border border-line px-3 text-sm focus:border-charcoal/40 focus:outline-none" />
        </div>
      </div>
    </div>
  );
}
