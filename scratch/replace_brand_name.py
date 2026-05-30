import os
import re

root_dir = r"C:\Users\aksha\devpulse-complete-codebase\devpulse-frontend"
ignored_dirs = {".next", "node_modules", ".git", ".vercel"}
target_extensions = {".tsx", ".ts", ".html", ".json", ".md"}

pattern = re.compile(r'rakshex', re.IGNORECASE)

def should_replace(content, start, end):
    # Get the line containing the match
    line_start = content.rfind('\n', 0, start) + 1
    line_end = content.find('\n', end)
    if line_end == -1:
        line_end = len(content)
    line = content[line_start:line_end]
    
    # Get 50 chars before and after for context
    prefix = content[max(0, start-50):start]
    suffix = content[end:end+50]
    
    # 1. Check if it's an import, export, or require statement
    if 'import ' in line or 'require(' in line or 'export ' in line:
        if not (line.strip().startswith('//') or line.strip().startswith('/*') or line.strip().startswith('*')):
            return False
            
    # 2. Check if it's part of a URL/domain or file path extensions
    if re.match(r'^\.(in|site|app|png|jpeg|jpg|ico|svg|webmanifest|csv)\b', suffix, re.IGNORECASE):
        return False
        
    # Check if preceded by @ (email) or mailto:
    if prefix.endswith('@') or prefix.lower().endswith('mailto:'):
        return False
        
    # Check if preceded by http:// or https://
    if re.search(r'https?://[a-zA-Z0-9.-]*$', prefix, re.IGNORECASE) or re.search(r'https?:\\/\\/[a-zA-Z0-9.-]*$', prefix, re.IGNORECASE):
        return False
        
    # 3. Check if it's inside quotes of href, src, action, url, or image attributes
    if re.search(r'\b(href|src|action|image|url)\s*=\s*[\'"][^\'"]*$', prefix, re.IGNORECASE):
        return False
        
    # 4. Check if it's inside CSS class names (className="...")
    if re.search(r'\b(className|class)\s*=\s*[\'"][^\'"]*$', prefix, re.IGNORECASE):
        return False
        
    # 5. Check if it's an environment variable name (uppercase with underscores, or has NEXT_PUBLIC_)
    word_start = start
    while word_start > 0 and (content[word_start-1].isalnum() or content[word_start-1] in '_-'):
        word_start -= 1
    word_end = end
    while word_end < len(content) and (content[word_end].isalnum() or content[word_end] in '_-'):
        word_end += 1
    full_word = content[word_start:word_end]
    if full_word.isupper() and '_' in full_word:
        return False
    if 'NEXT_PUBLIC_' in full_word:
        return False
        
    return True

modified_files = []

for root, dirs, files in os.walk(root_dir):
    # Prune ignored directories in place
    dirs[:] = [d for d in dirs if d not in ignored_dirs]
    
    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext not in target_extensions:
            continue
            
        file_path = os.path.join(root, file)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Skipping {file_path} due to read error: {e}")
            continue
            
        matches = list(pattern.finditer(content))
        if not matches:
            continue
            
        new_content = []
        last_idx = 0
        replaced_any = False
        
        for match in matches:
            start, end = match.span()
            val = match.group(0)
            
            if should_replace(content, start, end):
                # We need to replace it with RaksHex
                new_content.append(content[last_idx:start])
                new_content.append("RaksHex")
                last_idx = end
                replaced_any = True
                print(f"Replacing in {os.path.relpath(file_path, root_dir)}: '{val}' -> 'RaksHex'")
            else:
                # Keep original
                new_content.append(content[last_idx:end])
                last_idx = end
                
        if replaced_any:
            new_content.append(content[last_idx:])
            final_str = "".join(new_content)
            
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(final_str)
                modified_files.append(os.path.relpath(file_path, root_dir))
            except Exception as e:
                print(f"Error writing to {file_path}: {e}")

print("\n--- Spelling Replacements Completed ---")
print(f"Total modified files: {len(modified_files)}")
for f in modified_files:
    print(f" - {f}")
