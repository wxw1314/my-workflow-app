import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export async function POST(req: NextRequest) {
  try {
    // 1. 解析请求参数
    const { table, value,idField } = await req.json();

    // 2. 连接数据库
    await dbConnect();

    // 3. 根据表名选择模型（目前仅支持 products，可扩展）
    if (table === 'products') {
      let result;
      if (value !== undefined && value !== null && value !== '' && idField) {
        const castedValue = idField === 'productId' ? Number(value) : value;
        const filter = { [idField]: castedValue };
        result = await Product.findOne({}).lean();
        console.log(result);
        if (!result) {
          return NextResponse.json({ error: '产品未找到' }, { status: 400 });
        }
      } else {
        // 查询所有产品
        result = await Product.find({}).lean();
      }
      return NextResponse.json(result);
    } 
    // 可扩展其他表，例如 orders
    else if (table === 'orders') {
      // 如果有 Order 模型，类似处理
      // const orders = await Order.find({}).lean();
      // return NextResponse.json(orders);
      return NextResponse.json({ error: '表 "orders" 暂未实现' }, { status: 400 });
    } 
    else {
      return NextResponse.json({ error: `未知的表: ${table}` }, { status: 400 });
    }
  } catch (error) {
    console.error('数据库查询失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}