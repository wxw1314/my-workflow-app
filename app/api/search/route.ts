import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: '缺少查询参数 q' }, { status: 400 });
  }
  // 模拟搜索结果
  const results = [
    { title: `关于 ${query} 的结果1`, url: 'https://example.com/1' },
    { title: `关于 ${query} 的结果2`, url: 'https://example.com/2' },
    { title: `关于 ${query} 的结果3`, url: 'https://example.com/3' },
  ];
  return NextResponse.json({ query, results });
}