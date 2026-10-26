const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://db_ohdmuseum_user:rzsmbZ4nIZjkbNnr6XzgH8UneHJVhtra@dpg-dbfde2vb9u1s73cgv4m0-a.singapore-postgres.render.com/db_ohdmuseum',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  await client.connect();
  const q1 = await client.query('SELECT count(*) FROM menu_items;');
  const q2 = await client.query('SELECT count(*) FROM role_permissions;');
  const q3 = await client.query('SELECT u.email, u.full_name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id;');
  const q4 = await client.query('SELECT key, group_name FROM system_settings ORDER BY group_name;');

  console.log('--- Deep Verification on Render.com ---');
  console.log('menu_items count:', q1.rows[0].count);
  console.log('role_permissions count:', q2.rows[0].count);
  console.log('Super Admin User:', q3.rows[0]);
  console.log('System settings configured:', q4.rows.map(r => `${r.group_name}:${r.key}`).join(', '));

  await client.end();
}

verify().catch(console.error);
