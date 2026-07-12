const fs = require("fs");
const path = require("path");
const {
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} = require("docx");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "docs", "legal");
const outputDir = path.join(root, "devpulse-frontend", "public", "legal");

const documents = [
  ["TERMS_OF_SERVICE.md", "rakshex-terms-of-service.docx"],
  ["PRIVACY_POLICY.md", "rakshex-privacy-policy.docx"],
  ["DATA_PROCESSING_ADDENDUM.md", "rakshex-data-processing-addendum.docx"],
  ["SERVICE_LEVEL_AGREEMENT.md", "rakshex-enterprise-sla.docx"],
  ["ACCEPTABLE_USE_POLICY.md", "rakshex-acceptable-use-policy.docx"],
  ["REFUND_CANCELLATION_POLICY.md", "rakshex-refund-cancellation-policy.docx"],
  ["SUBPROCESSOR_REGISTER.md", "rakshex-subprocessor-register.docx"],
  ["AI_TRANSPARENCY_STATEMENT.md", "rakshex-ai-transparency-statement.docx"],
];

function plain(value) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\r/g, "");
}

function paragraph(text, options = {}) {
  return new Paragraph({
    ...options,
    children: [new TextRun({ text: plain(text), size: 21 })],
    spacing: { after: 160 },
  });
}

function markdownToParagraphs(markdown) {
  const children = [];
  let inTable = false;

  for (const line of markdown.split("\n")) {
    if (!line.trim()) {
      inTable = false;
      continue;
    }
    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: plain(line.slice(2)), size: 36, bold: true, color: "0F172A" })],
          spacing: { after: 260 },
        }),
      );
      continue;
    }
    if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: plain(line.slice(3)), size: 27, bold: true, color: "0F766E" })],
          spacing: { before: 260, after: 140 },
        }),
      );
      continue;
    }
    if (line.startsWith("### ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: plain(line.slice(4)), size: 24, bold: true, color: "0F172A" })],
          spacing: { before: 180, after: 120 },
        }),
      );
      continue;
    }
    if (line.startsWith("- ")) {
      children.push(paragraph(line.slice(2), { bullet: { level: 0 } }));
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      children.push(paragraph(line.replace(/^\d+\.\s/, ""), { numbering: { reference: "legal-list", level: 0 } }));
      continue;
    }
    if (line.startsWith("|")) {
      if (/^\|\s*-/.test(line)) continue;
      inTable = true;
      children.push(paragraph(line.split("|").filter(Boolean).map((cell) => cell.trim()).join(" | "), { indent: { left: 360 } }));
      continue;
    }
    if (inTable) inTable = false;
    children.push(paragraph(line));
  }
  return children;
}

async function generate(sourceName, outputName) {
  const markdown = fs.readFileSync(path.join(sourceDir, sourceName), "utf8");
  const document = new Document({
    creator: "RakshEx",
    title: markdown.match(/^#\s+(.+)$/m)?.[1] ?? "RakshEx Legal Document",
    numbering: {
      config: [{ reference: "legal-list", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left" }] }],
    },
    sections: [
      {
        properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: "center",
                children: [
                  new TextRun({ text: "RakshEx | Legal document | Page ", size: 18, color: "64748B" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "64748B" }),
                ],
              }),
            ],
          }),
        },
        children: markdownToParagraphs(markdown),
      },
    ],
  });
  await fs.promises.writeFile(path.join(outputDir, outputName), await Packer.toBuffer(document));
}

async function main() {
  await fs.promises.mkdir(outputDir, { recursive: true });
  for (const [sourceName, outputName] of documents) await generate(sourceName, outputName);
  console.log(`Generated ${documents.length} legal DOCX files in ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
