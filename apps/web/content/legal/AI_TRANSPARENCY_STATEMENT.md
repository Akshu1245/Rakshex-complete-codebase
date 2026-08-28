# RakshEx AI Transparency Statement

Version: 2026-07-12

RakshEx is an AI governance and security control plane. It does not present itself as a provider of a foundation model and does not make autonomous high-impact decisions about people.

## Intended Use

The Service helps organisations inventory AI access, govern credentials and subscriptions, evaluate policies, identify security and cost signals, and create audit evidence. It may inspect configured request metadata, perform redaction and prompt-injection checks, estimate cost, and produce findings or remediation suggestions.

## Human Oversight

Customer administrators configure policies, provider routes, budgets, approval flows, and kill switches. Findings, risk scores, forecasts, compliance mappings, and suggested fixes require human review before production action. Customers must ensure lawful human oversight for their own AI systems, especially in employment, finance, healthcare, education, insurance, public services, biometric processing, or other high-impact contexts.

## Data Labels

RakshEx distinguishes data quality rather than manufacturing precision:

- Verified: retrieved from an authorised provider, connector, or controlled runtime.
- Imported: supplied by Customer through an authorised report or file.
- Estimated: calculated from documented assumptions such as model pricing or seat allocation.
- Inferred: derived from code, telemetry, or heuristic signals and requiring confirmation.

## Limits

Detection is probabilistic. PII, secret, prompt-injection, anomaly, and policy controls can create false positives and false negatives. Provider usage, subscription, model, reasoning-token, and cost data are limited by provider capabilities and permissions. Customers should test policies before enforcement, preserve independent controls, and retain an emergency provider-revocation path.

## Content and Model Providers

When Customer routes a request to a third-party model, that provider controls the underlying model, output, availability, retention, and terms. RakshEx does not use Customer prompts or provider credentials to train a general-purpose model unless Customer expressly opts in under separate written terms.

## Regulatory Position

Customers remain responsible for classifying and operating their own AI use cases under applicable law. RakshEx provides transparency, logging, policy, and evidence features that may assist governance; it does not certify compliance. Contact privacy@rakshex.in or security@rakshex.in for architecture and data-handling questions.
