'use client';
import { useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeProps,Node } from '@xyflow/react';

export type WeatherNodeData = {
  id:string;
  city:string;
}

export type WeatherNodeType = Node<WeatherNodeData,'WeatherNode'>
export default function WeatherNode({ id, data }: NodeProps<WeatherNodeType>) {
  const [city, setCity] = useState(data.city || '');
  const { updateNodeData } = useReactFlow();

  return (
    <div style={{ background: '#fff3e0', border: '1px solid #fb8c00', borderRadius: '8px', padding: '12px', minWidth: '180px' }}>
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
      <div style={{ fontWeight: 'bold' }}>☀️ 天气查询</div>
      <input type="text" placeholder="输入城市名 (如 Beijing)" value={city} onChange={(e) => { setCity(e.target.value); updateNodeData(id, { city: e.target.value }); }} style={{ width: '100%', marginTop: '4px', padding: '4px' }} />
    </div>
  );
}