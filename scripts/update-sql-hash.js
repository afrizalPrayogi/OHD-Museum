const fs = require('fs');

const oldHash = '$2a$12$e0X9qfWkX4zKz8w7B.i4cebUfg27V2yGzU4b6QvWJ6eU5rM6iJd9i';
const newHash = '$2b$10$4iRsM17U3We/Rgc5Vhrw9uPgGWr6qFmdAcS8EZCa4s5Y/IM084l8y';

['database/seed.sql', 'database/full_database.sql'].forEach((file) => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(oldHash, newHash);
    fs.writeFileSync(file, content);
    console.log(`Updated hash in ${file}`);
  }
});
