import { redirect } from "next/navigation";

/** Alias so /docs/getting-started lands on the public Agent Firewall hello-world. */
export default function DocsGettingStartedRedirect() {
  redirect("/docs/agent-firewall");
}
