const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || 'postgresql://db_ohdmuseum_user:rzsmbZ4nIZjkbNnr6XzgH8UneHJVhtra@dpg-dbfde2vb9u1s73cgv4m0-a.singapore-postgres.render.com/db_ohdmuseum';

async function runMigration() {
  console.log('Connecting to Render PostgreSQL...');
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected successfully to Render.com PostgreSQL!');

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');

    console.log('\n--- 1. Executing schema.sql ---');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('schema.sql executed successfully!');

    console.log('\n--- 2. Executing seed.sql ---');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await client.query(seedSql);
    console.log('seed.sql executed successfully!');

    console.log('\n--- 3. Verifying Created Tables & Data ---');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`Total tables found: ${tablesRes.rows.length}`);
    tablesRes.rows.forEach((row, i) => {
      console.log(` ${i + 1}. ${row.table_name}`);
    });

    // Verification queries on key tables
    const rolesCount = await client.query('SELECT COUNT(*) FROM roles;');
    const permissionsCount = await client.query('SELECT COUNT(*) FROM permissions;');
    const usersCount = await client.query('SELECT COUNT(*) FROM users;');
    const categoriesCount = await client.query('SELECT COUNT(*) FROM categories;');
    const settingsCount = await client.query('SELECT COUNT(*) FROM system_settings;');
    const menusCount = await client.query('SELECT COUNT(*) FROM menus;');

    console.log('\n--- Data Counts ---');
    console.log(`roles: ${rolesCount.rows[0].count}`);
    console.log(`permissions: ${permissionsCount.rows[0].count}`);
    console.log(`users: ${usersCount.rows[0].count}`);
    console.log(`categories: ${categoriesCount.rows[0].count}`);
    console.log(`system_settings: ${settingsCount.rows[0].count}`);
    console.log(`menus: ${menusCount.rows[0].count}`);

    console.log('\nAll migrations and verifications completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
