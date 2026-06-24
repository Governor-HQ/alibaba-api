// GET  /api/admin/charter/prices — full grid: all zones x vehicle types with prices
// POST /api/admin/charter/prices  { zone_id, vehicle_type_id, round_trip_price } — upsert one cell
// Also: GET returns one_way_factor; POST with { one_way_factor } updates the factor
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
export async function GET(request) {
  const _auth = await requireAdmin(request, 'charter_pricing'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const [zones, types, prices, factor] = await Promise.all([
      pool.query('SELECT id, name FROM charter_zones ORDER BY name ASC'),
      pool.query('SELECT id, name, capacity FROM charter_vehicle_types ORDER BY sort_order ASC, capacity ASC'),
      pool.query('SELECT zone_id, vehicle_type_id, round_trip_price FROM charter_prices'),
      pool.query("SELECT value FROM charter_settings WHERE key='one_way_factor'")
    ]);
    return NextResponse.json({
      success:true,
      zones: zones.rows,
      vehicle_types: types.rows,
      prices: prices.rows,
      one_way_factor: factor.rows.length ? parseFloat(factor.rows[0].value) : 0.6
    });
  } catch (e) { return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function POST(request) {
  const _auth = await requireAdmin(request, 'charter_pricing'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try {
    const body = await request.json();

    // Update the one-way factor
    if (body.one_way_factor != null) {
      const f = parseFloat(body.one_way_factor);
      if (isNaN(f) || f <= 0 || f >= 1) {
        return NextResponse.json({ success:false, error:'Factor must be between 0 and 1.' }, { status:400 });
      }
      await pool.query(
        "INSERT INTO charter_settings (key,value) VALUES ('one_way_factor',$1) ON CONFLICT (key) DO UPDATE SET value=$1",
        [String(f)]
      );
      return NextResponse.json({ success:true, one_way_factor:f });
    }

    // Upsert a price cell
    const { zone_id, vehicle_type_id, round_trip_price } = body;
    if (!zone_id || !vehicle_type_id || round_trip_price == null) {
      return NextResponse.json({ success:false, error:'zone, vehicle type and price required.' }, { status:400 });
    }
    const price = parseFloat(round_trip_price);
    if (isNaN(price) || price <= 0) {
      return NextResponse.json({ success:false, error:'Enter a valid price.' }, { status:400 });
    }
    const r = await pool.query(
      `INSERT INTO charter_prices (zone_id, vehicle_type_id, round_trip_price)
       VALUES ($1,$2,$3)
       ON CONFLICT (zone_id, vehicle_type_id) DO UPDATE SET round_trip_price=$3
       RETURNING *`,
      [zone_id, vehicle_type_id, price]
    );
    return NextResponse.json({ success:true, price:r.rows[0] });
  } catch (e) {
    console.error('Price set error:', e);
    return NextResponse.json({ success:false, error:'Failed.' }, { status:500 });
  }
}
