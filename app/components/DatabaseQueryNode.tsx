'use client';
import { useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow, NodeProps, Node } from '@xyflow/react';

// 扩展类型定义
export type DatabaseQueryNodeData = {
  label?: string;
  table: string;
  idField: string;      // 新增：存储当前表对应的 ID 字段名
  value: string;
};

export type DatabaseQueryNodeType = Node<DatabaseQueryNodeData, 'DatabaseQueryNode'>;

// 表配置映射：表名 -> { label, placeholder, idField }
const TABLE_CONFIG: Record<string, { label: string; placeholder: string; idField: string }> = {
  products: {
    label: '产品 ID',
    placeholder: '输入产品 ID (如 prod_001)',
    idField: 'productId',
  },
  orders: {
    label: '订单 ID',
    placeholder: '输入订单 ID (如 ord_2024001)',
    idField: 'orderId',
  },
  users: {
    label: '用户 ID',
    placeholder: '输入用户 ID (如 user_123)',
    idField: 'userId',
  },
};

export default function DatabaseQueryNode({ id, data }: NodeProps<DatabaseQueryNodeType>) {
  const { updateNodeData } = useReactFlow();

  // 处理字段变更（通用）
  const handleChange = useCallback(
    (field: string, val: string) => {
      updateNodeData(id, { [field]: val });
    },
    [id, updateNodeData]
  );

  // 处理表切换：同时更新 table 和 idField
  const handleTableChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newTable = e.target.value;
      const config = TABLE_CONFIG[newTable];
      if (config) {
        updateNodeData(id, {
          table: newTable,
          idField: config.idField,
        });
      }
    },
    [id, updateNodeData]
  );

  // 获取当前表的配置
  const currentConfig = useMemo(() => {
    return TABLE_CONFIG[data.table] || TABLE_CONFIG.products;
  }, [data.table]);

  return (
    <div
      style={{
        background: '#e3f2fd',
        border: '1px solid #1e88e5',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '200px',
      }}
    >
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
      <div style={{ fontWeight: 'bold' }}>🗄️ 查询数据库</div>

      <select
        value={data.table || 'products'}
        onChange={handleTableChange}
        style={{ width: '100%', marginTop: '4px' }}
      >
        <option value="products">产品表</option>
        <option value="orders">订单表</option>
        <option value="users">用户表</option>
      </select>

      <div style={{ marginTop: '4px' }}>
        <label style={{ fontSize: '12px', color: '#555', display: 'block' }}>
          {currentConfig.label}
        </label>
        <input
          type="text"
          placeholder={currentConfig.placeholder}
          value={data.value || ''}
          onChange={(e) => handleChange('value', e.target.value)}
          style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
      </div>

      {/* 可选：显示当前使用的 idField（调试用） */}
      <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
        字段: {data.idField || currentConfig.idField}
      </div>
    </div>
  );
}