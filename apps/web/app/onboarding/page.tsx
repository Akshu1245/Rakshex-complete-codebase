"use client";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

type StepKey = "importCollection" | "runScan" | "reviewFindings" | "inviteTeam" | "setupCompliance";

const STEP_ACTIONS: Record<StepKey, { href: string; cta: string; auto: boolean }> = {
  importCollection: { href: "/import", cta: "Import a collection", auto: true },
  runScan: { href: "/scanning", cta: "Run a scan", auto: true },
  reviewFindings: { href: "/findings", cta: "Review findings", auto: true },
  inviteTeam: { href: "/team", cta: "Invite a teammate", auto: true },
  setupCompliance: { href: "/compliance", cta: "Open compliance", auto: false },
};

export default function OnboardingPage() {
  const utils = trpc.useUtils();
  const progressQuery = trpc.onboarding.getProgress.useQuery();
  const progress = progressQuery.data;
  const loading = progressQuery.isLoading;

  const completeStepMutation = trpc.onboarding.completeStep.useMutation({
    onSuccess: () => utils.onboarding.getProgress.invalidate(),
  });

  const steps: {
    id: StepKey;
    completedKey: keyof NonNullable<typeof progress>;
    title: string;
    description: string;
  }[] = [
    {
      id: "importCollection",
      completedKey: "importCollectionCompleted",
      title: "Import a Collection",
      description: "Import your first API collection — completes automatically when you import",
    },
    {
      id: "runScan",
      completedKey: "runScanCompleted",
      title: "Run a Security Scan",
      description: "Scan a collection — completes automatically when a scan is queued",
    },
    {
      id: "reviewFindings",
      completedKey: "reviewFindingsCompleted",
      title: "Review Findings",
      description: "Open a finding detail — completes automatically when you review one",
    },
    {
      id: "inviteTeam",
      completedKey: "inviteTeamCompleted",
      title: "Invite Team Members",
      description: "Send an invite — completes automatically when you invite someone",
    },
    {
      id: "setupCompliance",
      completedKey: "setupComplianceCompleted",
      title: "Setup Compliance Reporting",
      description:
        "Configure PCI DSS or OWASP reporting (or mark done after you generate a report)",
    },
  ];

  const isStepDone = (key: keyof NonNullable<typeof progress>) => !!(progress && progress[key]);

  return (
    <div className="text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Onboarding</h1>
            <p className="text-gray-400 mt-1">
              Steps complete from real product actions — not checkboxes alone
            </p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            &larr; Dashboard
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="space-y-6">
            {steps.map((step) => {
              const done = isStepDone(step.completedKey);
              const action = STEP_ACTIONS[step.id];
              return (
                <div
                  key={step.id}
                  className={`p-6 rounded-lg border ${
                    done ? "bg-green-900/20 border-green-500" : "bg-black/50 border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`w-6 h-6 rounded-full border-2 ${
                            done ? "bg-green-500 border-green-500" : "bg-gray-700 border-gray-600"
                          }`}
                        >
                          {done && (
                            <svg
                              className="w-4 h-4 text-white ml-1"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold">{step.title}</h3>
                        {action.auto && !done && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{step.description}</p>
                    </div>
                    {!done && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <Link
                          href={action.href}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors text-center"
                        >
                          {action.cta}
                        </Link>
                        {!action.auto && (
                          <button
                            onClick={() => completeStepMutation.mutate({ step: step.id })}
                            disabled={completeStepMutation.isPending}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 rounded-lg font-medium transition-colors text-sm"
                          >
                            Mark complete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
