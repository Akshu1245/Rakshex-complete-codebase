# task_generator.py - Auto-discovers work
import os, json, glob, subprocess
from datetime import datetime

tasks = []
repo_path = os.getcwd()

# Source 1: Uncommitted changes
result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True, cwd=repo_path)
if result.stdout.strip():
    tasks.append({"source": "git_uncommitted", "task": "Commit pending changes", "files": result.stdout.strip().split('\n')[:5]})

# Source 2: TODOs in code
for file in glob.glob('**/*.py', recursive=True) + glob.glob('**/*.ts', recursive=True) + glob.glob('**/*.md', recursive=True):
    try:
        with open(file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if 'TODO' in line.upper():
                tasks.append({"source": "todo", "task": f"Fix TODO: {line.strip()}", "file": file, "line": i+1})
                break
    except: pass

# Source 3: Untested files
for file in glob.glob('**/*.ts', recursive=True):
    test_file = file.replace('.ts', '.test.ts').replace('/server/', '/server/__tests__/')
    if not os.path.exists(test_file):
        tasks.append({"source": "untested", "task": f"Write tests for {os.path.basename(file)}", "file": file})

# Write to inbox
for i, task in enumerate(tasks[:10]):
    task_file = f".team/inbox/auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{i}.json"
    with open(task_file, 'w') as f:
        json.dump(task, f, indent=2)
    print(f"Task generated: {task['task'][:50]}...")

print(f"Generated {min(10, len(tasks))} tasks")
