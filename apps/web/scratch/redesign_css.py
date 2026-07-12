import re

with open("C:/Users/aksha/devpulse-complete-codebase/devpulse-frontend/app/globals.css", "r", encoding="utf-8") as f:
    css = f.read()

# Replace colors
css = css.replace("#00d4aa", "#14B8A6")
css = css.replace("#0a0a0a", "#0F1419")
css = css.replace("#0F0F0F", "#0F1419")
css = css.replace("#0A0E1A", "#0F1419")
css = css.replace("rgba(0, 212, 170,", "rgba(20, 184, 166,")
css = css.replace("rgba(0,212,170,", "rgba(20,184,166,")

# Remove glowing drop-shadows and box-shadows
css = re.sub(r"box-shadow:\s*0\s+0\s+\d+px\s+rgba\([^)]+\);?", "box-shadow: none;", css)
css = re.sub(r"box-shadow:\s*0\s+0\s+\d+px\s+#[0-9a-fA-F]+;?", "box-shadow: none;", css)
css = re.sub(r"box-shadow:\s*0\s+0\s+\d+px\s+#[0-9a-fA-F]+,\s*0\s+0\s+\d+px\s+#[0-9a-fA-F]+;?", "box-shadow: none;", css)
css = re.sub(r"filter:\s*drop-shadow\([^)]+\);?", "", css)

# Fix pulse-dot-anim to not use box-shadows (which cause glow)
pulse_dot_fixed = """@keyframes pulse-dot-anim {
  0% { transform: scale(0.95); opacity: 0.7; }
  70% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.7; }
}"""
css = re.sub(r"@keyframes pulse-dot-anim\s*\{[^}]*\}", pulse_dot_fixed, css)

with open("C:/Users/aksha/devpulse-complete-codebase/devpulse-frontend/app/globals.css", "w", encoding="utf-8") as f:
    f.write(css)

print("CSS redesign applied successfully!")
