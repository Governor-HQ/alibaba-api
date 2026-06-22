// POST /api/charter/quote  { zone_id, vehicle_type_id, trip_type, quantity }
// Returns the computed price. Price is ALWAYS computed server-side from the
// price grid (never trusted from the client).
import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { zone_id, vehicle_type_id, trip_type, quantity } = await request.json();
    if (!zone_id || !vehicle_type_id) {
      return NextResponse.json({ success: false, error: 'Select a zone and vehicle type.' }, { status: 400 });
    }
    const qty = Math.max(1, parseInt(quantity) || 1);

    const priceRow = await pool.query(
      'SELECT round_trip_price FROM charter_prices WHERE zone_id = $1 AND vehicle_type_id = $2',
      [zone_id, vehicle_type_id]
    );
    if (priceRow.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No price set for this combination yet. Please contact us.' }, { status: 404 });
    }

    const roundTrip = parseFloat(priceRow.rows[0].round_trip_price);
    const factorRow = await pool.query("SELECT value FROM charter_settings WHERE key = 'one_way_factor'");
    const factor = factorRow.rows.length ? parseFloat(factorRow.rows[0].value) : 0.6;

    const isRound = trip_type !== 'one_way';
    const unitPrice = isRound ? roundTrip : Math.round(roundTrip * factor);
    const total = unitPrice * qty;

    return NextResponse.json({
      success: true,
      unit_price: unitPrice,
      quantity: qty,
      total_price: total,
      trip_type: isRound ? 'round_trip' : 'one_way'
    });
  } catch (error) {
    console.error('Charter quote error:', error);
    return NextResponse.json({ success: false, error: 'Failed to compute price.' }, { status: 500 });
  }
}
