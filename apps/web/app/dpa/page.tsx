import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { LEGAL_DOCUMENTS } from "@/lib/legalPack";

export const dynamic = "force-static";

export const metadata = {
  title: "Data Processing Addendum | RaksHex",
  description: LEGAL_DOCUMENTS.dpa.description,
  alternates: { canonical: "/legal/dpa" },
};

export default function DpaPage() {
  return <LegalDocumentPage document={LEGAL_DOCUMENTS.dpa} />;
}
