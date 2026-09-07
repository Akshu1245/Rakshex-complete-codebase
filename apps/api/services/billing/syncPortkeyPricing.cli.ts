import { syncPortkeyPricing } from "./portkeyPricingSync";
import type { PortkeySupportedProvider } from "./portkeyPricingSource";

async function main() {
  const argv: string[] = process.argv.slice(2);
  const args = new Set(argv);
  const apply = args.has("--apply");
  const requested = argv
    .filter((arg: string) => arg.startsWith("--provider="))
    .map((arg: string) => arg.slice("--provider=".length)) as PortkeySupportedProvider[];

  const allowed = new Set<PortkeySupportedProvider>([
    "openai",
    "anthropic",
    "azure_openai",
    "openrouter",
  ]);
  for (const provider of requested) {
    if (!allowed.has(provider)) throw new Error(`Unsupported pricing provider: ${provider}`);
  }

  const result = await syncPortkeyPricing({
    apply,
    ...(requested.length > 0 ? { providers: requested } : {}),
  });

  console.table(result);
  if (!apply) {
    console.log(
      "Dry-run only. Re-run with --apply to append changed rates to model_price_versions.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
