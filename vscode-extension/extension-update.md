// Add to your existing extension.ts:

// 1. Import the new command
import { PostmanImportCommand } from "./postmanImport";

// 2. In activate() function, register the command:
const postmanImport = new PostmanImportCommand(context, api);
context.subscriptions.push(
vscode.commands.registerCommand("rakshex.importPostman", () =>
postmanImport.execute()
)
);

// 3. Update package.json contributes.commands:
// {
// "command": "rakshex.importPostman",
// "title": "Import Postman Collection & Scan",
// "category": "Rakshex",
// "icon": "$(file-code)"
// }

// 4. Add to welcome view buttons:
// <button onclick="sendMessage('importPostman')">📥 Import Postman Collection</button>
