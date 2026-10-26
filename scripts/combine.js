const fs = require('fs');
const schema = fs.readFileSync('database/schema.sql', 'utf8');
const seed = fs.readFileSync('database/seed.sql', 'utf8');
const full = schema + '\n\n-- =============================================================================\n-- INITIAL SEED DATA EXECUTION\n-- =============================================================================\n\n' + seed;
fs.writeFileSync('database/full_database.sql', full);
fs.writeFileSync('database/db-ohdmuseum.sql', full);
console.log('Regenerated full_database.sql and db-ohdmuseum.sql successfully.');
