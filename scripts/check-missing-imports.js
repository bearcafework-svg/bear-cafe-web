// scripts/check-missing-imports.js
// Automated validator to catch missing imports, undefined identifiers, and unimported UI components
import ts from 'typescript';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const configPath = path.join(rootDir, 'tsconfig.app.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error('Error reading tsconfig.app.json:', configFile.error.messageText);
  process.exit(1);
}

const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, rootDir);
const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);

const missingNames = [];

for (const sourceFile of program.getSourceFiles()) {
  const normPath = sourceFile.fileName.replace(/\\/g, '/');
  if (normPath.includes('node_modules') || !normPath.includes('/src/')) continue;

  const diags = program.getSemanticDiagnostics(sourceFile);
  for (const d of diags) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (msg.startsWith('Cannot find name')) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start || 0);
      const relPath = path.relative(rootDir, sourceFile.fileName).replace(/\\/g, '/');
      missingNames.push({ file: relPath, line: line + 1, col: character + 1, message: msg });
    }
  }
}

if (missingNames.length > 0) {
  console.error(`\n❌ Found ${missingNames.length} missing import / undefined identifier errors:`);
  for (const item of missingNames) {
    console.error(`   - ${item.file}:${item.line}:${item.col} -> ${item.message}`);
  }
  console.error('\nPlease import the missing components or functions before committing/deploying.\n');
  process.exit(1);
} else {
  console.log('✅ All imports and identifier references in src/ are verified successfully! No missing components found.');
  process.exit(0);
}
