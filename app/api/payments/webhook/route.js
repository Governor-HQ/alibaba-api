import pool from '@/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const rawBody = await request.text();

    // Verify this request genuinely came from Paystack, not someone faking it
    const signature = request.headers.get('x-paystack-signature');
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // Car rental bookings use references starting with ALB-PAY-
      // Bus seat bookings use references starting with ALB-BUS-
      // Charter payments use references starting with ALB-CHTPAY-
      // We update whichever table the reference actually belongs to.
      if (reference.startsWith('ALB-CHT-')) {
        await pool.query(
          `UPDATE charter_bookings SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE payment_reference = $1`,
          [reference]
        );
      } else if (reference.startsWith('ALB-BUS-')) {
        await pool.query(
          `UPDATE seat_bookings SET payment_status = 'paid', status = 'confirmed' WHERE payment_reference = $1`,
          [reference]
        );
      } else {
        await pool.query(
          `UPDATE bookings SET payment_status = 'paid', status = 'confirmed' WHERE payment_reference = $1`,
          [reference]
        );
      }
    }

    // Paystack just needs a 200 response to know we received it
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
