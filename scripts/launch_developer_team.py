from __future__ import annotations

import concurrent.futures
import json
import os
from pathlib import Path
from typing import Any

from openai import OpenAI

ROOT = Path('/home/ubuntu/Rakshex-complete-codebase')
OUT = ROOT / 'team_outputs'
OUT.mkdir(exist_ok=True)

WORKSTREAMS: dict[str, dict[str, Any]] = {
    'engineering-reliability': {
        'role': 'You are the Engineering Reliability lead for RaksHex.',
        'files': [
            'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'tsconfig.base.json',
            'tsconfig.json', 'apps/vscode-extension/package.json', 'apps/vscode-extension/tsconfig.json',
            '.github/workflows/ci.yml', '.github/workflows/security-scan.yml', 'CLAUDE.md'
        ],
        'ask': 'Diagnose the install, formatting, TypeScript, build, and CI problems from the audit. Produce concrete, minimal file changes and exact validation commands. Do not weaken gates or suppress failures. Flag any uncertainty.'
    },
    'security-verification': {
        'role': 'You are the Security Verification lead for RaksHex.',
        'files': [
            'apps/api/services/credentialBroker.ts', 'apps/api/services/credentialBroker.test.ts',
            'apps/api/api/agentFirewall.ts', 'apps/api/api/agentFirewall.e2e.test.ts',
            'apps/api/services/gateway/enforcement.ts', 'packages/action-control/src/authority.ts',
            'packages/sdk/src/firewall.ts', 'docs/SECURITY.md', 'CLAUDE.md'
        ],
        'ask': 'Design and, where possible, specify exact tests and fixes needed to prove the authenticated brokered action path. Focus on allow and deny semantics, secret non disclosure, replay, concurrency, origin pinning, redirects, SSRF, runtime key scope, tenant isolation, and egress ledger evidence. Do not claim a control is proven without a concrete test.'
    },
    'product-experience': {
        'role': 'You are the Product Experience lead for RaksHex.',
        'files': [
            'apps/web/app/page.tsx', 'apps/web/app/agent-firewall/page.tsx',
            'apps/web/components/agent-firewall/DecisionTrace.tsx',
            'apps/web/components/agent-firewall/LedgerTimeline.tsx',
            'apps/web/app/globals.css', 'apps/web/app/layout.tsx', 'docs/SDK.md'
        ],
        'ask': 'Design a practical implementation plan for a five minute Agent Firewall onboarding and a separable operational control plane. Identify concrete UI changes that can be implemented without inventing backend APIs. Preserve honest warnings about broker coverage and bypass risk. Prioritize accessibility, clear states, provider aware credential setup, and investigation usability.'
    },
    'release-operations': {
        'role': 'You are the Release Operations and Trust lead for RaksHex.',
        'files': [
            'docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md', 'docs/operations/LEGAL_LAUNCH_SIGNOFF.md',
            'docs/operations/LAUNCH_SIGNOFF_MATRIX.md', 'docs/RELEASE_CHECKLIST.md',
            'release/README_START_HERE.md', 'scripts/market-ready-check.mjs',
            'scripts/release-gates.mjs', '.env.example'
        ],
        'ask': 'Turn the market readiness gaps into executable release evidence templates and safe launch safeguards. Specify documentation and script changes that prevent public GA claims before CI, broker E2E, operations, payment, monitoring, backup, restore, and legal evidence exist. Do not fabricate completed evidence.'
    },
}


def read_context(paths: list[str], max_total: int = 120_000) -> str:
    chunks: list[str] = []
    total = 0
    for rel in paths:
        path = ROOT / rel
        if not path.exists():
            chunks.append(f'\n===== {rel} =====\n[MISSING]\n')
            continue
        text = path.read_text(errors='replace')
        remaining = max_total - total
        if remaining <= 0:
            break
        text = text[:remaining]
        chunks.append(f'\n===== {rel} =====\n{text}\n')
        total += len(text)
    return ''.join(chunks)


def run_agent(name: str, spec: dict[str, Any]) -> tuple[str, str]:
    client = OpenAI()
    context = read_context(spec['files'])
    prompt = f'''{spec['role']}\n\nRepository root: {ROOT}\nCurrent audited commit: b125da9\nThis is a bounded workstream in a coordinated team. You do not have shell tools in this call, so do not pretend to edit files or run tests. Instead, return an implementation brief that another engineer can apply.\n\nWorkstream request:\n{spec['ask']}\n\nReturn these sections:\n1. Findings ordered P0, P1, P2 with file references.\n2. Exact proposed changes, including code or configuration snippets where safe.\n3. Tests and commands that must pass.\n4. Risks, dependencies, and items that must not be changed.\n5. A concise handoff to the integration lead.\n\nRepository context follows:\n{context}'''
    response = client.chat.completions.create(
        model='gpt-5.5',
        messages=[
            {'role': 'system', 'content': 'You are a senior staff engineer. Be precise, skeptical, and implementation oriented.'},
            {'role': 'user', 'content': prompt},
        ],
        max_completion_tokens=7000,
        extra_body={'reasoning': {'effort': 'high'}},
    )
    content = response.choices[0].message.content or ''
    out_path = OUT / f'{name}.md'
    out_path.write_text(content)
    meta = {
        'workstream': name,
        'model': 'gpt-5.5',
        'files': spec['files'],
        'output': str(out_path),
        'usage': response.usage.model_dump() if response.usage else None,
    }
    (OUT / f'{name}.json').write_text(json.dumps(meta, indent=2))
    return name, str(out_path)


def main() -> None:
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(run_agent, name, spec) for name, spec in WORKSTREAMS.items()]
        results = [future.result() for future in futures]
    (OUT / 'TEAM_RUN.json').write_text(json.dumps({'results': results}, indent=2))
    print(json.dumps({'results': results}, indent=2))


if __name__ == '__main__':
    main()
