with open("C:/Users/aksha/devpulse-complete-codebase/devpulse-frontend/components/PublicHeader.tsx", "r", encoding="utf-8") as f:
    code = f.read()

# Replace cyan utility classes with teal-accent
code = code.replace("text-cyan-400", "text-teal-accent")
code = code.replace("group-hover:text-cyan-400", "group-hover:text-teal-accent")
code = code.replace("hover:text-cyan-400", "hover:text-teal-accent")
code = code.replace("bg-cyan-500", "bg-teal-accent")
code = code.replace("hover:bg-cyan-500", "hover:bg-teal-accent/80")

# Update Start Free CTA styling (remove bg-[#06b6d4], custom shadow, and text-black, make it solid teal with white text)
old_cta = 'className="bg-[#06b6d4] hover:bg-[#0891b2] text-black font-semibold text-xs font-mono uppercase tracking-wider px-4 py-2 rounded shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all"'
new_cta = 'className="bg-teal-accent hover:bg-[#0D9488] text-white font-semibold text-xs font-mono uppercase tracking-wider px-4 py-2 rounded transition-all"'
code = code.replace(old_cta, new_cta)

# Also fix the mobile Start Free button at the bottom of header
old_mobile_cta = 'className="flex-1 text-center bg-cyan-500 text-black py-2.5 rounded font-bold text-sm"'
new_mobile_cta = 'className="flex-1 text-center bg-teal-accent hover:bg-[#0D9488] text-white py-2.5 rounded font-bold text-sm"'
code = code.replace(old_mobile_cta, new_mobile_cta)

with open("C:/Users/aksha/devpulse-complete-codebase/devpulse-frontend/components/PublicHeader.tsx", "w", encoding="utf-8") as f:
    f.write(code)

print("PublicHeader redesign applied successfully!")
