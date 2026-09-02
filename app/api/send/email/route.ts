import nodemailer from 'nodemailer';
export async function POST(req: NextRequest) {
  const { to, subject, text } = await req.json();
  const transporter = nodemailer.createTransport({ /* 配置你的邮箱服务 */ });
  await transporter.sendMail({ from: '[email protected]', to, subject, text });
  return NextResponse.json({ success: true });
}