export const dynamic = "force-static";

export function GET() {
  const body = [
    "Contact: mailto:security@rakshex.in",
    "Preferred-Languages: en",
    "Policy: https://www.rakshex.in/trust",
    "Canonical: https://www.rakshex.in/.well-known/security.txt",
  ].join("\n");
  return new Response(`${body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
