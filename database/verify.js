const fs = require('fs');

const schema = fs.readFileSync('database/schema.sql', 'utf8');
const seed = fs.readFileSync('database/seed.sql', 'utf8');

// Check em dash (R-02)
const emDashRegex = /\u2014/g;
const schemaEmDash = (schema.match(emDashRegex) || []).length;
const seedEmDash = (seed.match(emDashRegex) || []).length;

console.log('Em dash count in schema.sql:', schemaEmDash);
console.log('Em dash count in seed.sql:', seedEmDash);

if (schemaEmDash > 0 || seedEmDash > 0) {
  console.error('FAIL: Found forbidden em dash character');
  process.exit(1);
}

// Check table creation order vs references
const createTableRegex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z_]+)/gi;
const tablesCreated = [];
let match;
while ((match = createTableRegex.exec(schema)) !== null) {
  tablesCreated.push(match[1]);
}
console.log('Tables created count:', tablesCreated.length);
console.log('Tables list:', tablesCreated.join(', '));

const fkRegex = /REFERENCES\s+([a-zA-Z_]+)\s*\(([a-zA-Z_]+)\)/gi;
let fkMatch;
let fkErrors = 0;
while ((fkMatch = fkRegex.exec(schema)) !== null) {
  const refTable = fkMatch[1];
  const refCol = fkMatch[2];
  if (!tablesCreated.includes(refTable)) {
    console.error('ERROR: FK refers to unknown table:', refTable);
    fkErrors++;
  }
}

if (fkErrors === 0) {
  console.log('SUCCESS: All Foreign Key references and order of creation are 100% valid!');
} else {
  console.error('FAIL: Found FK errors');
  process.exit(1);
}
