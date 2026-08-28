import { sanitizeHtml } from "@/lib/sanitizeHtml";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="text-slate-400">$1</code>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+|\/[^)]+|mailto:[^)]+)\)/g,
      '<a class="text-[#14B8A6] hover:underline" href="$2">$1</a>',
    );
}

function renderTable(rows: string[]): string {
  const parsed = rows
    .map((row) =>
      row
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.some((cell) => cell.length > 0));
  if (parsed.length === 0) return "";
  const header = parsed[0]!;
  const body = parsed.slice(1).filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell)));
  const thead = `<thead><tr class="border-b border-slate-700 text-slate-400">${header
    .map((cell) => `<th class="py-2 pr-3 font-semibold">${inlineFormat(cell)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = `<tbody>${body
    .map(
      (cells, i) =>
        `<tr class="${i < body.length - 1 ? "border-b border-slate-800" : ""}">${cells
          .map((cell) => `<td class="py-2 pr-3 align-top">${inlineFormat(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody>`;
  return `<div class="mt-3 overflow-x-auto"><table class="w-full min-w-[560px] text-left text-xs border-collapse">${thead}${tbody}</table></div>`;
}

function renderList(items: string[]): string {
  return `<ul class="mt-3 list-disc space-y-2 pl-5">${items
    .map((item) => `<li>${inlineFormat(item)}</li>`)
    .join("")}</ul>`;
}

/**
 * Convert the published legal-pack markdown into static HTML.
 * Intentionally small: the July 2026 pack uses headings, paragraphs, bullets, and GFM tables.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      i += 1;
      continue;
    }

    if (/^(Effective date|Version):/i.test(trimmed)) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      html.push(
        `<h2 class="text-xl font-semibold text-white mt-10">${inlineFormat(trimmed.slice(3))}</h2>`,
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      html.push(
        `<h3 class="text-lg font-semibold text-white mt-8">${inlineFormat(trimmed.slice(4))}</h3>`,
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        rows.push((lines[i] ?? "").trim());
        i += 1;
      }
      html.push(renderTable(rows));
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("- ")) {
        items.push((lines[i] ?? "").trim().slice(2));
        i += 1;
      }
      html.push(renderList(items));
      continue;
    }

    const paragraph: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !(lines[i] ?? "").trim().startsWith("#") &&
      !(lines[i] ?? "").trim().startsWith("|") &&
      !(lines[i] ?? "").trim().startsWith("- ")
    ) {
      paragraph.push((lines[i] ?? "").trim());
      i += 1;
    }
    html.push(`<p class="mt-3">${inlineFormat(paragraph.join(" "))}</p>`);
  }

  return html.join("\n");
}

export function markdownToSafeHtml(markdown: string): string {
  return sanitizeHtml(markdownToHtml(markdown));
}
