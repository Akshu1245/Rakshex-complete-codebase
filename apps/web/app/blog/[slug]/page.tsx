import type { Metadata } from "next";
import { redirect } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "RaksHex Research Notes",
    description:
      "Historical RaksHex blog posts are being refreshed so public claims match current private-beta evidence.",
    robots: { index: false, follow: true },
  };
}

export default async function BlogPost() {
  redirect("/blog");
}
