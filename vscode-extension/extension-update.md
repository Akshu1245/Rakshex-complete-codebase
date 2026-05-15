// Add to your existing extension.ts:

// 1. Import the new command
import { PostmanImportCommand } from "./postmanImport";

// 2. In activate() function, register the command:
const postmanImport = new PostmanImportCommand(context, api);
context.subscriptions.push(
  vscode.commands.registerCommand("devpulse.importPostman", () =>
    postmanImport.execute()
  )
);

// 3. Update package.json contributes.commands:
// {
//   "command": "devpulse.importPostman",
//   "title": "Import Postman Collection & Scan",
//   "category": "DevPulse",
//   "icon": "$(file-code)"
// }

// 4. Add to welcome view buttons:
// <button onclick="sendMessage('importPostman')">📥 Import Postman Collection</button>
