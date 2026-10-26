const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: 'postgresql://db_ohdmuseum_user:rzsmbZ4nIZjkbNnr6XzgH8UneHJVhtra@dpg-dbfde2vb9u1s73cgv4m0-a.singapore-postgres.render.com/db_ohdmuseum',
  ssl: { rejectUnauthorized: false }
});

async function syncAdminPassword() {
  const password = 'Admin@OHD2025!';
  const hash = await bcrypt.hash(password, 10);
  console.log('Generated hash:', hash);

  const res = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, full_name',
    [hash, 'admin@ohdmuseum.com']
  );

  console.log('Updated user in Render PostgreSQL:', res.rows[0]);
  await pool.end();
}

syncAdminPassword();
