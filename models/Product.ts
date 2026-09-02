// models/Product.ts
import mongoose, { Schema, model, models } from 'mongoose';

export interface IProduct {
  productId: number; // 你查询时用的主键
  // 其他字段可选，如果你不需要在查询结果中做类型转换，可以不定义
}

const ProductSchema = new Schema<IProduct>(
  {
    productId: { type: Number, required: true, unique: true },
  },
  { timestamps: false } // 如果不需要 createdAt/updatedAt
);

const Product = models.Product || model<IProduct>('Product', ProductSchema);
export default Product;