import { authenticateRequest } from '@/lib/rbac';
import { query } from '@/lib/db';
import { apiSuccess, apiUnauthorized, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = await authenticateRequest(request);
    if (!authUser) {
      return apiUnauthorized('Akses dashboard memerlukan autentikasi');
    }

    // Perform parallel aggregate queries
    const [
      artworksCount,
      artistsCount,
      exhibitionsCount,
      articlesCount,
      booksCount,
      reservationsSummary,
      inquiriesSummary,
      recentAuditLogs,
    ] = await Promise.all([
      query('SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE is_featured = true)::int as featured FROM artworks'),
      query('SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE is_prominent = true)::int as prominent FROM artists'),
      query(`SELECT 
              COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE status = 'current')::int as current,
              COUNT(*) FILTER (WHERE status = 'upcoming')::int as upcoming,
              COUNT(*) FILTER (WHERE status = 'past')::int as past
             FROM exhibitions`),
      query(`SELECT 
              COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE status = 'published')::int as published,
              COUNT(*) FILTER (WHERE status = 'draft')::int as draft
             FROM articles`),
      query('SELECT COUNT(*)::int as total FROM books'),
      query(`SELECT 
              COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
              COUNT(*) FILTER (WHERE status = 'confirmed')::int as confirmed,
              COALESCE(SUM(total_price) FILTER (WHERE status = 'confirmed'), 0)::numeric as total_revenue
             FROM reservations`),
      query(`SELECT 
              COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE status = 'unread')::int as unread
             FROM contact_inquiries`),
      query(`SELECT a.id, a.action, a.entity_name, a.record_id, a.created_at, u.full_name as author_name
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at DESC
             LIMIT 8`),
    ]);

    return apiSuccess(
      {
        summary: {
          artworks: {
            total: artworksCount.rows[0]?.total || 0,
            featured: artworksCount.rows[0]?.featured || 0,
          },
          artists: {
            total: artistsCount.rows[0]?.total || 0,
            prominent: artistsCount.rows[0]?.prominent || 0,
          },
          exhibitions: {
            total: exhibitionsCount.rows[0]?.total || 0,
            current: exhibitionsCount.rows[0]?.current || 0,
            upcoming: exhibitionsCount.rows[0]?.upcoming || 0,
            past: exhibitionsCount.rows[0]?.past || 0,
          },
          articles: {
            total: articlesCount.rows[0]?.total || 0,
            published: articlesCount.rows[0]?.published || 0,
            draft: articlesCount.rows[0]?.draft || 0,
          },
          books: {
            total: booksCount.rows[0]?.total || 0,
          },
          reservations: {
            total: reservationsSummary.rows[0]?.total || 0,
            pending: reservationsSummary.rows[0]?.pending || 0,
            confirmed: reservationsSummary.rows[0]?.confirmed || 0,
            revenue: Number(reservationsSummary.rows[0]?.total_revenue || 0),
          },
          inquiries: {
            total: inquiriesSummary.rows[0]?.total || 0,
            unread: inquiriesSummary.rows[0]?.unread || 0,
          },
        },
        recentActivity: recentAuditLogs.rows,
      },
      'Statistik dashboard berhasil dimuat'
    );
  } catch (error) {
    return apiError('Gagal memuat statistik dashboard', error);
  }
}
