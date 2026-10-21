/**
 * Validates every starter template definition against the template schema
 * and checks that its sample content renders without text overflow.
 * Run: npm run templates:validate
 */
import { STARTER_TEMPLATES } from "../src/templates/starter";
import { templateDefinitionSchema } from "../src/lib/templates/schema";
import { availableFormats, createProjectFromTemplate } from "../src/lib/rendering/scene";
import { renderInvitation } from "../src/lib/rendering/render";

let failures = 0;
for (const t of STARTER_TEMPLATES) {
  const parsed = templateDefinitionSchema.safeParse(t.definition);
  if (!parsed.success) {
    failures++;
    console.error(`✗ ${t.slug}`);
    for (const issue of parsed.error.issues) console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    continue;
  }
  const project = createProjectFromTemplate(parsed.data, { slug: t.slug, version: 1 });
  for (const format of availableFormats(parsed.data)) {
    const result = renderInvitation(parsed.data, project, { format, imageHref: () => "x" });
    if (result.overflow.length) {
      failures++;
      console.error(`✗ ${t.slug} (${format}) text overflow in: ${result.overflow.join(", ")}`);
    }
  }
  console.log(`✓ ${t.slug} — formats: ${availableFormats(parsed.data).join(", ")}`);
}
if (failures) {
  console.error(`${failures} problem(s) found`);
  process.exit(1);
}
console.log(`All ${STARTER_TEMPLATES.length} templates are valid.`);
