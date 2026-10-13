const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const files = ['devpulse-dashboard-ui/src/lib/api.ts', ...fs.readdirSync(path.join(root, 'devpulse-dashboard-ui/src/components')).filter(file => file.endsWith('.tsx')).map(file => 'devpulse-dashboard-ui/src/components/' + file)];
const calls = [];
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && /safeRequest|apiRequest|apiFetch/.test(node.expression.getText(source)) && node.arguments.length) {
      const target = node.arguments[0].getText(source);
      if (/^['"`]/.test(target)) {
        let method = 'GET', bodyKeys = null;
        const init = node.arguments[1];
        if (init && ts.isObjectLiteralExpression(init)) {
          for (const property of init.properties) {
            if (property.name?.getText(source) === 'method') method = property.initializer.getText(source).replace(/['"]/g, '');
            if (property.name?.getText(source) === 'body' && ts.isCallExpression(property.initializer)) {
              const body = property.initializer.arguments[0];
              if (body && ts.isObjectLiteralExpression(body) && body.properties.every(p => p.name)) bodyKeys = body.properties.map(p => p.name.getText(source).replace(/['"]/g, ''));
            }
          }
        }
        calls.push({file, path: target.slice(1, -1), method, bodyKeys});
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
process.stdout.write(JSON.stringify(calls));
