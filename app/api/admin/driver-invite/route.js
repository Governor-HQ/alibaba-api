// /api/admin/driver-invite
//   GET  → current shared invite code (creates one if missing)
//   POST → regenerate the invite code (old signup links stop working)
import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
function gen(){ const a='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<6;i++) s+=a[Math.floor(Math.random()*a.length)]; return 'DRIVE-'+s; }

export async function GET(request){
  const _auth = await requireAdmin(request, 'drivers_approve'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try{
    const r = await pool.query('SELECT invite_code FROM driver_settings ORDER BY id LIMIT 1');
    if(!r.rows.length){
      const code = gen();
      await pool.query('INSERT INTO driver_settings (invite_code) VALUES ($1)', [code]);
      return NextResponse.json({ success:true, invite_code:code });
    }
    return NextResponse.json({ success:true, invite_code:r.rows[0].invite_code });
  }catch(e){ console.error('driver-invite GET', e); return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}

export async function POST(request){
  const _auth = await requireAdmin(request, 'drivers_approve'); if (!_auth.ok) return NextResponse.json({ success:false, error:_auth.error }, { status:_auth.status });
  try{
    const code = gen();
    const r = await pool.query('SELECT id FROM driver_settings ORDER BY id LIMIT 1');
    if(r.rows.length){
      await pool.query('UPDATE driver_settings SET invite_code=$1, updated_at=NOW() WHERE id=$2', [code, r.rows[0].id]);
    } else {
      await pool.query('INSERT INTO driver_settings (invite_code) VALUES ($1)', [code]);
    }
    return NextResponse.json({ success:true, invite_code:code });
  }catch(e){ console.error('driver-invite POST', e); return NextResponse.json({ success:false, error:'Failed.' }, { status:500 }); }
}
