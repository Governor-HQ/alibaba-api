import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const maxPrice = searchParams.get('maxPrice');

    let query = 'SELECT * FROM cars WHERE available = true';
    const params = [];

    if (category && category !== 'all') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    if (maxPrice) {
      params.push(maxPrice);
      query += ` AND price_day <= $${params.length}`;
    }

    query += ' ORDER BY price_day ASC';

    const result = await pool.query(query, params);
    return NextResponse.json({ success: true, cars: result.rows });
  } catch (error) {
    console.error('Error fetching cars:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch cars' }, { status: 500 });
  }
}
