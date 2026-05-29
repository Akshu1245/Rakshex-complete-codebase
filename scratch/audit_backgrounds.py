import os
import re

files = [
    "devpulse-frontend/app/billing/page.tsx",
    "devpulse-frontend/app/compare/datadog/page.tsx",
    "devpulse-frontend/app/compare/langsmith/page.tsx",
    "devpulse-frontend/app/compare/snyk/page.tsx",
    "devpulse-frontend/app/compliance/page.tsx",
    "devpulse-frontend/app/dashboard/page.tsx",
    "devpulse-frontend/app/landing/page.tsx",
    "devpulse-frontend/app/pricing/page.tsx",
    "devpulse-frontend/app/scanning/page.tsx",
    "devpulse-frontend/app/settings/page.tsx",
    "devpulse-frontend/app/shadow-apis/page.tsx",
    "devpulse-frontend/app/token-analytics/page.tsx",
    "devpulse-frontend/components/AppShell.tsx",
    "devpulse-frontend/components/ConfirmModal.tsx",
    "devpulse-frontend/components/PaywallModal.tsx",
    "devpulse-frontend/components/PublicHeader.tsx",
    "devpulse-frontend/components/Sidebar.tsx",
    "devpulse-frontend/components/home/FeatureCards.tsx"
]

pattern = re.compile(r"(bg-background|bg-black|bg-\[#0a|bg-\[#0d|bg-\[#0f|background-color.*#0|backgroundColor.*#0)")

for filepath in files:
    full_path = os.path.join("C:\\Users\\aksha\\devpulse-complete-codebase", filepath)
    if not os.path.exists(full_path):
        print(f"File not found: {filepath}")
        continue
    printed_header = False
    with open(full_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            if pattern.search(line):
                if not printed_header:
                    print(f"\n=== File: {filepath} ===")
                    printed_header = True
                truncated_line = line.strip()
                if len(truncated_line) > 120:
                    truncated_line = truncated_line[:120] + "..."
                print(f"{idx}: {truncated_line}")
