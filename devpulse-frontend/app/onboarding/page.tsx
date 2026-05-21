"use client";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

type StepKey = "importCollection" | "runScan" | "reviewFindings" | "inviteTeam" | "setupCompliance";

export default function OnboardingPage() {
  const utils = trpc.useUtils();
  const progressQuery = trpc.onboarding.getProgress.useQuery();
  const progress = progressQuery.data;
  const loading = progressQuery.isLoading;

  const completeStepMutation = trpc.onboarding.completeStep.useMutation({
    onSuccess: () => utils.onboarding.getProgress.invalidate(),
  });

  const completeStep = (step: StepKey) => {
    completeStepMutation.mutate({ step });
  };

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
      description: "Import your first API collection to get started",
    },
    {
      id: "runScan",
      completedKey: "runScanCompleted",
      title: "Run a Security Scan",
      description: "Scan your collection for vulnerabilities",
    },
    {
      id: "reviewFindings",
      completedKey: "reviewFindingsCompleted",
      title: "Review Findings",
      description: "Review and prioritize security findings",
    },
    {
      id: "inviteTeam",
      completedKey: "inviteTeamCompleted",
      title: "Invite Team Members",
      description: "Add colleagues to collaborate",
    },
    {
      id: "setupCompliance",
      completedKey: "setupComplianceCompleted",
      title: "Setup Compliance Reporting",
      description: "Configure PCI DSS or OWASP reporting",
    },
  ];

  const isStepDone = (key: keyof NonNullable<typeof progress>) => !!(progress && progress[key]);

  return (
    <div className="text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Onboarding</h1>
            <p className="text-gray-400 mt-1">Get started with Rakshex in 5 steps</p>
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
              return (
                <div
                  key={step.id}
                  className={`p-6 rounded-lg border ${
                    done ? "bg-green-900/20 border-green-500" : "bg-gray-800 border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
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
                      </div>
                      <p className="text-sm text-gray-400">{step.description}</p>
                    </div>
                    {!done && (
                      <button
                        onClick={() => completeStep(step.id)}
                        disabled={completeStepMutation.isPending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg font-medium transition-colors"
                      >
                        Complete
                      </button>
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
