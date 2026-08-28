import Link from "next/link";
import type { LegalDocument } from "@/lib/legalPack";
import { markdownToSafeHtml } from "@/lib/legalMarkdown";

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  const html = markdownToSafeHtml(document.markdown);

  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-300">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">Legal</p>
        <h1 className="mt-3 text-4xl font-bold text-white">{document.title}</h1>
        <p className="mt-3 text-sm text-slate-500">Effective {document.effective}</p>
        <p className="mt-4 text-sm">
          <Link href="/legal" className="text-[#14B8A6] hover:underline">
            Legal center
          </Link>
          {" · "}
          <a href={document.download} className="text-[#14B8A6] hover:underline">
            Download DOCX
          </a>
        </p>
        <div
          className="mt-8 text-sm leading-7 text-slate-300"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </main>
  );
}
