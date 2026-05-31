import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { docsData } from "../docsData";

interface PageProps {
  params: {
    slug: string[];
  };
}

export async function generateMetadata({ params }: PageProps) {
  const path = params.slug.join("/");
  const page = docsData[path];

  if (!page) {
    return {
      title: "Doc Page Not Found — RaksHex Docs",
    };
  }

  return {
    title: `${page.title} — RaksHex Docs`,
    description: page.lead,
    alternates: { canonical: `/docs/${path}` },
  };
}

export default function DocSubPage({ params }: PageProps) {
  const path = params.slug.join("/");
  const page = docsData[path];

  if (!page) {
    notFound();
  }

  return (
    <article className="docs-article">
      <div className="docs-breadcrumb">{page.breadcrumb}</div>

      <div className="docs-article-header">
        <div>
          <h1>{page.title}</h1>
          <p className="docs-lead">{page.lead}</p>
        </div>
        <button className="docs-copy-btn">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy page
        </button>
      </div>

      <div
        className="docs-body-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.contentHtml) }}
      />

      <div className="mt-12 pt-6 border-t border-glass flex items-center justify-between">
        <Link href="/docs" className="docs-link">
          ← Back to overview
        </Link>
        <Link href="/register" className="docs-cta">
          Try RaksHex Free
        </Link>
      </div>
    </article>
  );
}
