from PIL import Image
import os

src = r"C:\Users\aksha\Downloads\ChatGPT Image May 31, 2026, 11_12_54 AM.png"
if not os.path.exists(src):
    print(f"Source file not found: {src}")
    exit(1)

img = Image.open(src).convert("RGBA")

sizes = [
    (r"devpulse-vscode\resources\icon.png", 128),
    (r"devpulse-frontend\public\favicon.png", 32),
    (r"devpulse-frontend\public\logo192.png", 192),
    (r"devpulse-frontend\public\logo512.png", 512),
    (r"devpulse-frontend\public\og-image.png", 256),
]

for rel_path, size in sizes:
    dest_path = os.path.join(r"C:\Users\aksha\Downloads\DevPulse_Complete_Codebase", rel_path)
    dest_dir = os.path.dirname(dest_path)
    os.makedirs(dest_dir, exist_ok=True)
    
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(dest_path)
    print(f"Saved {dest_path} at {size}x{size}")

# STEP 3: Replace favicon.ico with the new 32x32 PNG renamed to favicon.ico or converted to ico
favicon_ico_path = os.path.join(r"C:\Users\aksha\Downloads\DevPulse_Complete_Codebase", r"devpulse-frontend\public\favicon.ico")
resized_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
# Save as ICO (or just PNG as ICO)
resized_32.save(favicon_ico_path, format="ICO")
print(f"Saved {favicon_ico_path} as ICO")
