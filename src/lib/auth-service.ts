import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Simulated OTP sending (replace with Twilio/Firebase in production)
export async function sendOTP(phone: string): Promise<string> {
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Check if user exists, if not create
  const user = await prisma.user.upsert({
    where: { phone },
    update: { otp, otpExpiry },
    create: { phone, otp, otpExpiry },
  });

  // TODO: Send OTP via Twilio/Firebase
  console.log(`OTP for ${phone}: ${otp}`);

  return user.id;
}

export async function verifyOTP(phone: string, otp: string): Promise<{ success: boolean; userId?: string; message: string }> {
  const user = await prisma.user.findUnique({
    where: { phone },
  });

  if (!user) {
    return { success: false, message: 'User not found' };
  }

  if (!user.otp || user.otp !== otp) {
    return { success: false, message: 'Invalid OTP' };
  }

  if (!user.otpExpiry || user.otpExpiry < new Date()) {
    return { success: false, message: 'OTP expired' };
  }

  // Mark user as verified and clear OTP
  await prisma.user.update({
    where: { phone },
    data: { verified: true, otp: null, otpExpiry: null },
  });

  return { success: true, userId: user.id, message: 'OTP verified successfully' };
}
