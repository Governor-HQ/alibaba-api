// app/api/routes/route.js
//
// GET /api/routes → returns all active interstate routes
// This is public — customers see this when picking where to travel

import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT * FROM routes WHERE active = true ORDER BY origin, destination'
    );

    return NextResponse.json({
      success: true,
      routes: result.rows
    });

  } catch (error) {
    console.error('Error fetching routes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch routes' },
      { status: 500 }
    );
  }
}
