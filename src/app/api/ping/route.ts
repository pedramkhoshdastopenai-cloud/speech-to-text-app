import { NextResponse } from 'next/server';

export async function GET() {
  // این کد هیچ هزینه‌ای نداره و فقط سرور رو بیدار نگه میداره
  return NextResponse.json({ 
    status: 'alive', 
    time: new Date().toISOString() 
  });
}