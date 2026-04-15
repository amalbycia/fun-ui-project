/**
 * fix_quotes.cjs
 * Converts any single- or double-quoted string that contains ${...}
 * into a backtick template literal, so the expressions actually evaluate.
 */
const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');

let fixCount = 0;

// Replace 'string with ${...} inside' → `string with ${...} inside`
// Handles single-quoted strings that contain template expressions
code = code.replace(/'([^'\n]*\$\{[^'\n]*)'/g, (match, inner) => {
  fixCount++;
  return '`' + inner + '`';
});

// Same for double-quoted strings
code = code.replace(/"([^"\n]*\$\{[^"\n]*)"/g, (match, inner) => {
  fixCount++;
  return '`' + inner + '`';
});

fs.writeFileSync('main.js', code);
console.log(`Fixed ${fixCount} broken string literals → template literals.`);
