import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transformLegacyProject, LegacyFileSystemEntry, LegacyScriptContent } from "./transform";

const here = dirname(fileURLToPath(import.meta.url));
const snapshotDir = join(here, "snapshot");
const outputDir = join(here, "output");

const fileSystem: LegacyFileSystemEntry[] = JSON.parse(
  readFileSync(join(snapshotDir, "fileSystem.json"), "utf-8")
);
const scripts: Record<string, LegacyScriptContent> = JSON.parse(
  readFileSync(join(snapshotDir, "scripts.json"), "utf-8")
);
const viewModes: Record<string, "script" | "notepad"> = JSON.parse(
  readFileSync(join(snapshotDir, "viewModes.json"), "utf-8")
);

const nowIso = new Date().toISOString();
const projects = fileSystem
  .filter((entry) => entry.type === "script")
  .map((entry) => {
    const content = scripts[entry.id] ?? { parts: [], notepadContent: [] };
    const mode = viewModes[entry.id] ?? "script";
    return transformLegacyProject(entry, content, mode, nowIso);
  });

mkdirSync(outputDir, { recursive: true });

const jsonl = projects.map((project) => JSON.stringify(project)).join("\n");
writeFileSync(join(outputDir, "projects.jsonl"), jsonl, "utf-8");

const summaryLines = projects.map((project, index) => {
  const pageCount = project.sections.reduce((sum, section) => sum + section.pages.length, 0);
  const scriptChars = project.sections.reduce(
    (sum, section) => sum + section.pages.reduce((s, page) => s + page.script.length, 0),
    0
  );
  return `${index + 1}. ${project.name} | sections=${project.sections.length} pages=${pageCount} scriptChars=${scriptChars}`;
});
const summary = summaryLines.join("\n");
writeFileSync(join(outputDir, "summary.txt"), summary, "utf-8");

console.log(summary);
console.log(`\n총 ${projects.length}개 프로젝트를 scripts/legacyMigration/output/projects.jsonl 에 저장했습니다.`);
