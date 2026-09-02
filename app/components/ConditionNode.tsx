'use client';

import { useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeProps, Node } from '@xyflow/react';

export type ConditionNodeData = {
  label?: string;
  condition: string; // JavaScript 表达式，如 "input.includes('错误')"
};

export type ConditionNodeType = Node<ConditionNodeData, 'conditionNode'>;

export default function ConditionNode({ id, data }: NodeProps<ConditionNodeType>) {
  const [condition, setCondition] = useState(data.condition || 'input.length > 0');
  const { updateNodeData } = useReactFlow();

  const handleConditionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setCondition(newVal);
    updateNodeData(id, { condition: newVal });
  }, [id, updateNodeData]);

  return (
    <div
      style={{
        background: '#fff5e6',
        border: '1px solid #ff9800',
        borderRadius: '8px',
        padding: '12px 16px',
        minWidth: '200px',
        maxWidth: '320px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      {/* 输入端口（左侧） */}
      <Handle type="target" position={Position.Left} id="input" />

      {/* 输出端口（右侧）：true 和 false 两个出口 */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="true" 
        style={{ top: '30%', background: '#4caf50' }} 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        id="false" 
        style={{ top: '70%', background: '#f44336' }} 
      />

      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🔀 条件分支</div>

      <label style={{ fontSize: '12px', color: '#555', display: 'block' }}>
        条件表达式 (可使用 <code>input</code> 变量)
      </label>
      <textarea
        value={condition}
        onChange={handleConditionChange}
        placeholder="例如: input.includes('错误')"
        style={{
          width: '100%',
          minHeight: '50px',
          padding: '4px 6px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '12px',
          resize: 'vertical',
          fontFamily: 'monospace',
        }}
      />
      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
        <span style={{ color: '#4caf50' }}>● true</span> 上方出口 &nbsp; 
        <span style={{ color: '#f44336' }}>● false</span> 下方出口
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>ID: {id}</div>
    </div>
  );
}