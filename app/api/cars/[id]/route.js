import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const result = await pool.query('SELECT * FROM cars WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Car not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, car: result.rows[0] });
  } catch (error) {
    console.error('Error fetching car:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch car' }, { status: 500 });
  }
}
