import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { docsData } from "../docsData";
import { DocsCopyButton } from "../CopyButton";

interface PageProps {
  params: Promise<{
    slug: string[];
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const path = slug.join("/");
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

export default async function DocSubPage({ params }: PageProps) {
  const { slug } = await params;
  const path = slug.join("/");
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
        <DocsCopyButton />
      </div>

      <div
        className="docs-body-content"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.contentHtml) }}
      />

      <div className="mt-12 pt-6 border-t border-glass flex items-center justify-between">
        <Link href="/docs" className="docs-link">
          ← Back to overview
        </Link>
        <Link href="/waitlist" className="docs-cta">
          Request access
        </Link>
      </div>
    </article>
  );
}
