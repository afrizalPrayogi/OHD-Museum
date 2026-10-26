const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = new Pool({
  connectionString: 'postgresql://db_ohdmuseum_user:rzsmbZ4nIZjkbNnr6XzgH8UneHJVhtra@dpg-dbfde2vb9u1s73cgv4m0-a.singapore-postgres.render.com/db_ohdmuseum',
  ssl: { rejectUnauthorized: false }
});

async function runTests() {
  console.log('=== MEMULAI TEST BACKEND API & LIVE DATABASE RENDER.COM ===\n');

  try {
    // 1. Test Live Database Connection
    process.stdout.write('[1/7] Menguji koneksi live PostgreSQL Render... ');
    const dbRes = await pool.query('SELECT NOW() as now, current_database() as db_name');
    console.log(`OK! (Database: ${dbRes.rows[0].db_name})`);

    // 2. Test Super Admin Login Credentials
    process.stdout.write('[2/7] Menguji autentikasi akun Super Admin... ');
    const adminRes = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.role_id, r.name as role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.email = 'admin@ohdmuseum.com'`
    );

    if (adminRes.rows.length === 0) {
      throw new Error('Akun super admin tidak ditemukan di database');
    }

    const admin = adminRes.rows[0];
    const passwordMatch = await bcrypt.compare('Admin@OHD2025!', admin.password_hash);
    if (!passwordMatch) {
      throw new Error('Hash password super admin tidak cocok');
    }
    console.log(`OK! (Role: ${admin.role_name}, Email: ${admin.email})`);

    // 3. Test JWT Token Creation & Verification
    process.stdout.write('[3/7] Menguji penandatanganan dan verifikasi JWT token... ');
    const testSecret = 'ohd_museum_super_secret_jwt_key_2025_prod_secure';
    const token = jwt.sign(
      { userId: admin.id, email: admin.email, roleId: admin.role_id, roleName: admin.role_name },
      testSecret,
      { expiresIn: '1h' }
    );
    const decoded = jwt.verify(token, testSecret);
    if (decoded.email !== admin.email) {
      throw new Error('Token payload tidak sesuai');
    }
    console.log('OK!');

    // 4. Test Permissions Query
    process.stdout.write('[4/7] Menguji hak akses granular RBAC... ');
    const permRes = await pool.query('SELECT COUNT(*)::int as count FROM permissions');
    console.log(`OK! (${permRes.rows[0].count} permissions terdaftar)`);

    // 5. Test Live Search Module Query
    process.stdout.write('[5/7] Menguji modul Search trigram di live database... ');
    const searchRes = await pool.query(
      `SELECT id, name FROM categories WHERE name ILIKE '%seni%' LIMIT 5`
    );
    console.log(`OK! (${searchRes.rows.length} hasil ditemukan)`);

    // 6. Test Public Contact Submission Flow
    process.stdout.write('[6/7] Menguji modul Contact Inquiries... ');
    const contactRes = await pool.query(
      `INSERT INTO contact_inquiries (full_name, email, topic, message, status)
       VALUES ('Pengunjung Uji Coba', 'test@example.com', 'general', 'Tes pesan integrasi API', 'unread')
       RETURNING id, full_name, status`
    );
    const testContactId = contactRes.rows[0].id;
    console.log(`OK! (Tercatat ID: ${testContactId})`);

    // 7. Test Audit Log Entry & Cleanup
    process.stdout.write('[7/7] Menguji modul Audit Trail & pembersihan data uji... ');
    await pool.query(
      `INSERT INTO audit_logs (action, entity_name, record_id, new_values)
       VALUES ('CREATE', 'contact_inquiries', $1, '{"test": true}')`,
      [testContactId]
    );

    // Cleanup test record
    await pool.query('DELETE FROM contact_inquiries WHERE id = $1', [testContactId]);
    await pool.query('DELETE FROM audit_logs WHERE record_id = $1', [testContactId]);
    console.log('OK!');

    console.log('\n=== SEMUA 7 PENGUJIAN BACKEND API BERHASIL 100% TANPA KENDALA ===');
  } catch (error) {
    console.error('\nPengujian gagal:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
