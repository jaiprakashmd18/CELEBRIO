import Link from "next/link";
import type { ReactNode } from "react";
import { InvitationSvg } from "@/components/templates/invitation-svg";
import { Badge } from "@/components/ui/primitives";
import { formatDate, type DashboardProject } from "@/lib/data/dashboard";
import { FORMAT_SIZES } from "@/lib/templates/schema";

export function ProjectCard({ project, actions }: { project: DashboardProject; actions?: ReactNode }) {
  const size = project.data ? FORMAT_SIZES[project.data.format] : FORMAT_SIZES.portrait;
  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-white ring-1 ring-line">
      <Link href={`/editor/${project.id}`} className="block bg-sand/60 p-4">
        <div className="mx-auto max-h-72 overflow-hidden rounded-md bg-white shadow-soft" style={{ aspectRatio: `${size.width} / ${size.height}`, maxWidth: size.width > size.height ? "100%" : "10rem" }}>
          {project.definition && project.data ? (
            <InvitationSvg definition={project.definition} project={project.data} idPrefix={`p${project.id.slice(0, 8)}`} title={`Thumbnail of ${project.title}`} />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-xs text-gray">Preview unavailable</div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{project.title}</h3>
            {project.status === "purchased" && <Badge tone="success">Unlocked</Badge>}
          </div>
          <p className="text-xs text-gray">{project.templateName} · Edited {formatDate(project.updatedAt)}</p>
        </div>
        {actions}
      </div>
    </article>
  );
}
