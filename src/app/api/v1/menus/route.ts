import { query } from '@/lib/db';
import { apiSuccess, apiError } from '@/utils/response';

export const dynamic = 'force-dynamic';

interface MenuItemRow {
  id: string;
  menu_id: string;
  parent_id: string | null;
  label: string;
  url: string;
  target_blank: boolean;
  sort_order: number;
  is_active: boolean;
}

interface MenuItemNode extends MenuItemRow {
  children: MenuItemNode[];
}

interface MenuRow {
  id: string;
  location_code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationCode = searchParams.get('location_code');

    let menuSql = 'SELECT * FROM menus WHERE is_active = true';
    const params: any[] = [];

    if (locationCode) {
      params.push(locationCode);
      menuSql += ` AND location_code = $${params.length}`;
    }

    menuSql += ' ORDER BY created_at ASC';

    const menusResult = await query<MenuRow>(menuSql, params);

    // Fetch items for each menu and build nested tree
    const menusWithItems = await Promise.all(
      menusResult.rows.map(async (menu: MenuRow) => {
        const itemsResult = await query<MenuItemRow>(
          `SELECT * FROM menu_items 
           WHERE menu_id = $1 AND is_active = true
           ORDER BY sort_order ASC, label ASC`,
          [menu.id]
        );

        // Build tree
        const itemMap = new Map<string, MenuItemNode>();
        const rootItems: MenuItemNode[] = [];

        itemsResult.rows.forEach((item: MenuItemRow) => {
          itemMap.set(item.id, { ...item, children: [] });
        });

        itemsResult.rows.forEach((item: MenuItemRow) => {
          const node = itemMap.get(item.id)!;
          if (item.parent_id && itemMap.has(item.parent_id)) {
            itemMap.get(item.parent_id)!.children.push(node);
          } else {
            rootItems.push(node);
          }
        });

        return {
          ...menu,
          items: rootItems,
        };
      })
    );

    return apiSuccess(
      locationCode && menusWithItems.length === 1 ? menusWithItems[0] : menusWithItems,
      'Struktur navigasi menu berhasil dimuat'
    );
  } catch (error) {
    return apiError('Gagal memuat struktur navigasi menu', error);
  }
}
