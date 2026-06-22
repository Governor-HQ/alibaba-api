// GET /api/charter/catalog — public: active vehicle types, zones, and the one-way factor
import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [types, zones, setting] = await Promise.all([
      pool.query('SELECT id, name, capacity, guide_text FROM charter_vehicle_types WHERE active = TRUE ORDER BY sort_order ASC, capacity ASC'),
      pool.query('SELECT id, name, description FROM charter_zones WHERE active = TRUE ORDER BY name ASC'),
      pool.query("SELECT value FROM charter_settings WHERE key = 'one_way_factor'")
    ]);
    const oneWayFactor = setting.rows.length ? parseFloat(setting.rows[0].value) : 0.6;
    return NextResponse.json({
      success: true,
      vehicle_types: types.rows,
      zones: zones.rows,
      one_way_factor: oneWayFactor
    });
  } catch (error) {
    console.error('Charter catalog error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load catalog.' }, { status: 500 });
  }
}
