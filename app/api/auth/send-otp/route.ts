import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/lib/auth-service';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    const userId = await sendOTP(phone);

    return NextResponse.json(
      { success: true, message: 'OTP sent successfully', userId },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
