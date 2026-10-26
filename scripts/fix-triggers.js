const fs = require('fs');
let schema = fs.readFileSync('database/schema.sql', 'utf8');

// Replace each CREATE TRIGGER with DROP TRIGGER IF EXISTS followed by CREATE TRIGGER
schema = schema.replace(
  /CREATE TRIGGER (\w+)\s*\n\s*(BEFORE|AFTER) (UPDATE|INSERT|DELETE) ON (\w+)/g,
  'DROP TRIGGER IF EXISTS $1 ON $4;\nCREATE TRIGGER $1\n$2 $3 ON $4'
);

fs.writeFileSync('database/schema.sql', schema);
console.log('Successfully added DROP TRIGGER IF EXISTS to schema.sql');
