import { notFound } from "next/navigation";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { getLegalDocument, LEGAL_SLUGS } from "@/lib/legalPack";

export const dynamic = "force-static";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const document = getLegalDocument(slug);
  if (!document) return { title: "Legal | RaksHex" };
  return {
    title: `${document.title} | RaksHex`,
    description: document.description,
    alternates: { canonical: `/legal/${document.slug}` },
  };
}

export default async function LegalSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const document = getLegalDocument(slug);
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
