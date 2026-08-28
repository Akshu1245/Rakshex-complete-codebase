import { redirect } from "next/navigation";

/** Public CTA alias. Must not bounce to /login. */
export default function DocumentationRedirect() {
  redirect("/docs/agent-firewall");
}
