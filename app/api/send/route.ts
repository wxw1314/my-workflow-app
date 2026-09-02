import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log('发送消息:', body);
  return NextResponse.json({ success: true, message: '消息已发送' });
}