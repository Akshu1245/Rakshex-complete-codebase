import { redirect } from "next/navigation";

/** Public CTA alias. Must not bounce to /login. */
export default function GetStartedRedirect() {
  redirect("/docs/agent-firewall");
}
