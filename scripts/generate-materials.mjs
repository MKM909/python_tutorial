import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(projectRoot, '.materials-tmp');
const bundlePath = path.join(tmpDir, 'materials-bundle.mjs');
const downloadsDir = path.join(projectRoot, 'public', 'downloads');

await fs.mkdir(tmpDir, { recursive: true });
await fs.mkdir(downloadsDir, { recursive: true });

await build({
  entryPoints: [path.join(projectRoot, 'src', 'lib', 'materials.ts')],
  outfile: bundlePath,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'silent',
});

const { buildPythonStarterFiles, getGroupFeaturePdfFilename, getGroupStarterKitFilename, groupFeaturePacks } = await import(
  pathToFileURL(bundlePath).href
);

function groupMarkdown(group) {
  const featureLines = group.features.map((feature, index) => `${index + 1}. ${feature}`).join('\n');
  const stretchLines = group.stretchIdeas.map((idea) => `- ${idea}`).join('\n');

  return `# Group ${group.id}: ${group.title}

## Mission

${group.theme}

${group.overview}

## Required Features

Add at least these five features to your own copy of the budget tracker.

${featureLines}

## Stretch Ideas

${stretchLines}

## Beginner Instructions

1. First make sure the base budget tracker runs.
2. Add one feature at a time.
3. After each feature, run \`python main.py\`.
4. If the app breaks, undo only your last change and try again.
5. Prepare a short explanation of what each feature does.

## Presentation Tip

Do not only show code. Show the menu, add sample data, run your new feature, and explain the part of the code your group changed.
`;
}

function writePdf(group, markdown) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const maxWidth = 500;
  const lineHeight = 14;
  let y = margin;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text(`Group ${group.id}: ${group.title}`, margin, y);
  y += 28;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const lines = pdf.splitTextToSize(markdown.replace(/^# .+\n\n/, ''), maxWidth);

  for (const line of lines) {
    if (y > 770) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += lineHeight;
  }

  return Buffer.from(pdf.output('arraybuffer'));
}

const starterFiles = buildPythonStarterFiles();
for (const file of starterFiles) {
  const outputPath = path.join(downloadsDir, 'starter-files', file.path);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, file.content, 'utf8');
}

for (const group of groupFeaturePacks) {
  const markdown = groupMarkdown(group);
  const pdf = writePdf(group, markdown);
  const pdfFilename = getGroupFeaturePdfFilename(group.id);
  const zipFilename = getGroupStarterKitFilename(group.id);
  const groupZip = new JSZip();

  for (const file of starterFiles) {
    groupZip.file(file.path, file.content);
  }

  groupZip.file(`group-${group.id}-feature-pack.md`, markdown);
  groupZip.file(pdfFilename, pdf);
  groupZip.file(
    'README_START_HERE.md',
    `# Budget Tracker Starter Kit - Group ${group.id}

This zip is for Group ${group.id}: ${group.title}.

## What is inside

- snippets/: the scattered Python pieces to rebuild main.py.
- sample_data/budget_data.json: sample data for testing.
- README_NUDGE.md: gentle hints for arranging the snippets.
- ${pdfFilename}: your group's feature mission PDF.
- group-${group.id}-feature-pack.md: the same mission as text.

Do not use another group's zip. Each group has a different feature mission.
`,
  );

  await fs.writeFile(path.join(downloadsDir, `group-${group.id}-feature-pack.md`), markdown, 'utf8');
  await fs.writeFile(path.join(downloadsDir, pdfFilename), pdf);
  await fs.writeFile(path.join(downloadsDir, zipFilename), await groupZip.generateAsync({ type: 'nodebuffer' }));
}

await fs.rm(path.join(downloadsDir, 'budget-tracker-starter-kit.zip'), { force: true });

await fs.writeFile(
  path.join(downloadsDir, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      groups: groupFeaturePacks.map((group) => ({
        id: group.id,
        title: group.title,
        markdown: `group-${group.id}-feature-pack.md`,
        pdf: getGroupFeaturePdfFilename(group.id),
        starterZip: getGroupStarterKitFilename(group.id),
      })),
    },
    null,
    2,
  ),
  'utf8',
);

await fs.rm(tmpDir, { recursive: true, force: true });
console.log(`Generated ${groupFeaturePacks.length} group PDFs and starter kits in ${downloadsDir}`);
