export default function ApiHomePage() {
  const endpoints = [
    { method: 'GET', path: '/api/v1/health', desc: 'Pemeriksaan kesehatan sistem dan status koneksi live PostgreSQL' },
    { method: 'POST', path: '/api/v1/auth/login', desc: 'Autentikasi admin CMS dan penerbitan token JWT' },
    { method: 'GET', path: '/api/v1/auth/me', desc: 'Profil pengguna dan daftar hak akses permissions' },
    { method: 'GET', path: '/api/v1/dashboard/stats', desc: 'Statistik agregat koleksi, pameran, reservasi, dan log audit' },
    { method: 'GET', path: '/api/v1/artworks', desc: 'Katalog 2.000+ karya seni dengan filter medium, era, dan featured' },
    { method: 'GET', path: '/api/v1/artists', desc: 'Daftar seniman maestro seni rupa Indonesia dan filter marquee' },
    { method: 'GET', path: '/api/v1/exhibitions', desc: 'Agenda kalender pameran masa kini, mendatang, dan arsip' },
    { method: 'GET', path: '/api/v1/articles', desc: 'Publikasi wawasan kuratorial, kritik seni, dan rilis berita' },
    { method: 'GET', path: '/api/v1/books', desc: 'Katalog buku dan publikasi OHD Museum' },
    { method: 'GET', path: '/api/v1/banners', desc: 'Hero slider banner beranda desktop dan mobile' },
    { method: 'GET', path: '/api/v1/menus', desc: 'Struktur navigasi header, mega menu, dan footer bersarang' },
    { method: 'GET', path: '/api/v1/pages', desc: 'Konten halaman naratif profil Dr. OHD, sejarah, dan panduan kunjungan' },
    { method: 'GET', path: '/api/v1/categories', desc: 'Taksonomi terpusat untuk era, medium seni, topik, dan dokumen' },
    { method: 'GET', path: '/api/v1/documents', desc: 'Media library berkas brosur, press kit, dan katalog' },
    { method: 'POST', path: '/api/v1/reservations', desc: 'Formulir pemesanan tiket kunjungan dan sesi waktu' },
    { method: 'POST', path: '/api/v1/contact', desc: 'Formulir kontak pertanyaan pengunjung' },
    { method: 'GET', path: '/api/v1/settings', desc: 'Pengaturan global operasional, tarif tiket, dan tautan resmi' },
    { method: 'GET', path: '/api/v1/search', desc: 'Mesin pencarian terpusat PostgreSQL Trigram' },
    { method: 'GET', path: '/api/v1/audit-logs', desc: 'Buku jejak riwayat audit aktivitas pengelola CMS' },
  ];

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 20px', lineHeight: 1.6 }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'inline-block', backgroundColor: '#0284c7', color: '#ffffff', padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
          REST API LAYER
        </div>
        <h1 style={{ fontSize: '32px', margin: '0 0 12px 0', color: '#f8fafc' }}>
          Museum Oei Hong Djien (OHD) API
        </h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '16px' }}>
          Backend REST API Layer murni berbasis Next.js App Router dan PostgreSQL terkelola di Render.com.
        </p>
      </header>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', color: '#38bdf8', marginBottom: '16px' }}>Status Operasional</h2>
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#22c55e' }}>Online: Basis data live terhubung</div>
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>Region: Singapore (Render Managed PostgreSQL)</div>
          </div>
          <a
            href="/api/v1/health"
            style={{ backgroundColor: '#0284c7', color: '#ffffff', textDecoration: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 600 }}
          >
            Cek Endpoint Health
          </a>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '20px', color: '#38bdf8', marginBottom: '16px' }}>Katalog 14 Modul API (Route Handlers)</h2>
        <div style={{ display: 'grid', gap: '10px' }}>
          {endpoints.map((ep) => (
            <div
              key={ep.path + ep.method}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span
                style={{
                  backgroundColor: ep.method === 'POST' ? '#059669' : '#0284c7',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  minWidth: '45px',
                  textAlign: 'center',
                }}
              >
                {ep.method}
              </span>
              <code style={{ color: '#f1f5f9', fontSize: '14px', fontWeight: 600 }}>{ep.path}</code>
              <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: 'auto' }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
