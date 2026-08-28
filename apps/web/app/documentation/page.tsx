import { redirect } from "next/navigation";

/** Docs-named URL. Public start is /docs, not an in-app surface. */
export default function DocumentationRedirect() {
  redirect("/docs");
}
