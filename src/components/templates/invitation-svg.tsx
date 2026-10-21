import { createElement, type ReactNode } from "react";
import { renderInvitation, type RenderResult } from "@/lib/rendering/render";
import type { VNode } from "@/lib/rendering/vnode";
import { sampleImageUrl } from "@/lib/templates/samples";
import type { FormatId, ImageSource, ProjectData, TemplateDefinition } from "@/lib/templates/schema";
import { cn } from "@/lib/utils";

function camel(name: string): string {
  if (name === "class") return "className";
  if (name.startsWith("data-") || name.startsWith("aria-")) return name;
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Converts the engine's VNode tree into React elements (text stays escaped by React). */
export function vnodeToReact(node: VNode | string, key?: number): ReactNode {
  if (typeof node === "string") return node;
  const props: Record<string, unknown> = { key };
  for (const [k, v] of Object.entries(node.a)) {
    if (v === undefined || k === "xmlns") continue;
    props[camel(k)] = v;
  }
  return createElement(node.t, props, ...(node.c ?? []).map((c, i) => vnodeToReact(c, i)));
}

export function defaultImageHref(localUrls?: Record<string, string>) {
  return (source: ImageSource): string | null => {
    if (source.kind === "sample") return sampleImageUrl(source.id);
    if (source.kind === "asset") return `/api/assets/${source.assetId}`;
    return localUrls?.[source.localId] ?? null;
  };
}

export interface InvitationSvgProps {
  definition: TemplateDefinition;
  project: ProjectData;
  format?: FormatId;
  watermark?: boolean;
  idPrefix: string;
  title: string;
  className?: string;
  localUrls?: Record<string, string>;
  onRendered?: (result: RenderResult) => void;
}

/** Renders a live invitation with the same engine used for exports. */
export function InvitationSvg({ definition, project, format, watermark, idPrefix, title, className, localUrls }: InvitationSvgProps) {
  const result = renderInvitation(definition, project, { format, watermark, idPrefix, imageHref: defaultImageHref(localUrls) });
  const root = result.root;
  return createElement(
    "svg",
    {
      viewBox: root.a.viewBox,
      role: "img",
      "aria-label": title,
      className: cn("block h-auto w-full select-none", className),
      preserveAspectRatio: "xMidYMid meet",
    },
    createElement("title", null, title),
    ...(root.c ?? []).map((c, i) => vnodeToReact(c, i)),
  );
}
