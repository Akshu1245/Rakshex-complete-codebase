import dpa from "@/content/legal/DATA_PROCESSING_ADDENDUM.md";
import sla from "@/content/legal/SERVICE_LEVEL_AGREEMENT.md";
import aup from "@/content/legal/ACCEPTABLE_USE_POLICY.md";
import refund from "@/content/legal/REFUND_CANCELLATION_POLICY.md";
import subprocessors from "@/content/legal/SUBPROCESSOR_REGISTER.md";
import aiTransparency from "@/content/legal/AI_TRANSPARENCY_STATEMENT.md";

export type LegalDocId =
  | "dpa"
  | "sla"
  | "aup"
  | "refund"
  | "subprocessors"
  | "ai-transparency";

export type LegalDocument = {
  id: LegalDocId;
  slug: string;
  title: string;
  description: string;
  effective: string;
  download?: string;
  markdown: string;
};

/**
 * Published July 2026 customer legal pack, baked into the web app.
 * Document bodies must never be fetched from the API.
 */
export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  dpa: {
    id: "dpa",
    slug: "dpa",
    title: "Data Processing Addendum",
    description:
      "Controller-to-processor obligations, security measures, subprocessors, and transfer terms.",
    effective: "12 July 2026",
    download: "/legal/rakshex-data-processing-addendum.docx",
    markdown: dpa,
  },
  sla: {
    id: "sla",
    slug: "sla",
    title: "Enterprise Service Level Agreement",
    description:
      "Order-form SLA with availability target, support response targets, exclusions, and credits.",
    effective: "12 July 2026",
    download: "/legal/rakshex-enterprise-sla.docx",
    markdown: sla,
  },
  aup: {
    id: "aup",
    slug: "aup",
    title: "Acceptable Use Policy",
    description:
      "Boundaries for authorised scans, integrations, models, and AI-supported workflows.",
    effective: "12 July 2026",
    download: "/legal/rakshex-acceptable-use-policy.docx",
    markdown: aup,
  },
  refund: {
    id: "refund",
    slug: "refund",
    title: "Refund and Cancellation Policy",
    description:
      "Private beta: no self-serve checkout this week. Paid access is by invite or Order Form only.",
    effective: "12 July 2026",
    markdown: refund,
  },
  subprocessors: {
    id: "subprocessors",
    slug: "subprocessors",
    title: "Subprocessor Register",
    description: "Active, conditional, and customer-directed service-provider categories.",
    effective: "12 July 2026",
    download: "/legal/rakshex-subprocessor-register.docx",
    markdown: subprocessors,
  },
  "ai-transparency": {
    id: "ai-transparency",
    slug: "ai-transparency",
    title: "AI Transparency Statement",
    description: "Intended use, human oversight, data labels, limits, and provider boundaries.",
    effective: "12 July 2026",
    download: "/legal/rakshex-ai-transparency-statement.docx",
    markdown: aiTransparency,
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCUMENTS) as LegalDocId[];

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS[slug as LegalDocId];
}
