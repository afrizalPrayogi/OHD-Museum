import { query } from '@/lib/db';
import { apiSuccess, apiBadRequest, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const type = searchParams.get('type') || 'all';

    if (!q || q.trim().length < 2) {
      return apiBadRequest('Kata kunci pencarian minimal 2 karakter');
    }

    const searchTerm = `%${q.trim()}%`;
    const results: Record<string, any[]> = {};

    // 1. Search Artworks
    if (type === 'all' || type === 'artworks') {
      const artworks = await query(
        `SELECT 
          w.id,
          w.title,
          w.slug,
          w.creation_year,
          w.medium,
          w.image_url,
          a.name as artist_name,
          'artwork' as item_type
         FROM artworks w
         JOIN artists a ON a.id = w.artist_id
         WHERE w.title ILIKE $1 OR a.name ILIKE $1 OR w.medium ILIKE $1
         LIMIT 10`,
        [searchTerm]
      );
      results.artworks = artworks.rows;
    }

    // 2. Search Artists
    if (type === 'all' || type === 'artists') {
      const artists = await query(
        `SELECT 
          a.id,
          a.name,
          a.slug,
          a.portrait_url,
          a.era_period,
          'artist' as item_type
         FROM artists a
         WHERE a.name ILIKE $1 OR a.biography ILIKE $1
         LIMIT 10`,
        [searchTerm]
      );
      results.artists = artists.rows;
    }

    // 3. Search Exhibitions
    if (type === 'all' || type === 'exhibitions') {
      const exhibitions = await query(
        `SELECT 
          e.id,
          e.title,
          e.slug,
          e.start_date,
          e.end_date,
          e.status,
          e.cover_image_url,
          'exhibition' as item_type
         FROM exhibitions e
         WHERE e.title ILIKE $1 OR e.curator_name ILIKE $1
         LIMIT 10`,
        [searchTerm]
      );
      results.exhibitions = exhibitions.rows;
    }

    // 4. Search Articles
    if (type === 'all' || type === 'articles') {
      const articles = await query(
        `SELECT 
          a.id,
          a.title,
          a.slug,
          a.excerpt,
          a.cover_image_url,
          a.published_at,
          'article' as item_type
         FROM articles a
         WHERE a.status = 'published' AND (a.title ILIKE $1 OR a.excerpt ILIKE $1)
         LIMIT 10`,
        [searchTerm]
      );
      results.articles = articles.rows;
    }

    // 5. Search Books
    if (type === 'all' || type === 'books') {
      const books = await query(
        `SELECT 
          b.id,
          b.title,
          b.author_editor,
          b.isbn,
          b.publish_year,
          b.cover_image_url,
          'book' as item_type
         FROM books b
         WHERE b.title ILIKE $1 OR b.author_editor ILIKE $1 OR b.isbn ILIKE $1
         LIMIT 10`,
        [searchTerm]
      );
      results.books = books.rows;
    }

    const totalMatches = Object.values(results).reduce((acc, curr) => acc + curr.length, 0);

    return apiSuccess(
      {
        query: q,
        type,
        totalMatches,
        results,
      },
      'Pencarian berhasil diproses'
    );
  } catch (error) {
    return apiError('Gagal memproses pencarian', error);
  }
}
