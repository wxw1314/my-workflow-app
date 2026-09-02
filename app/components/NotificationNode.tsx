'use client';
import { useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeProps,Node  } from '@xyflow/react';

export type NotificationNodeData = {
  id:string;
  content:string;
  recipient:string;
  subject:string;
}

export type NotificationNodeType = Node<NotificationNodeData,'NotificationNode'>
export default function NotificationNode({ id, data }: NodeProps<NotificationNodeType>) {
  const { updateNodeData } = useReactFlow();

  return (
    <div style={{ background: '#fce4ec', border: '1px solid #d81b60', borderRadius: '8px', padding: '12px', minWidth: '220px' }}>
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
      <div style={{ fontWeight: 'bold' }}>📧 发送通知</div>
      <input type="text" placeholder="收件人 (邮箱/手机号)" value={data.recipient || ''} onChange={(e) => updateNodeData(id, { recipient: e.target.value })} style={{ width: '100%', marginTop: '4px', padding: '4px' }} />
      <input type="text" placeholder="标题" value={data.subject || ''} onChange={(e) => updateNodeData(id, { subject: e.target.value })} style={{ width: '100%', marginTop: '4px', padding: '4px' }} />
      <textarea placeholder="内容" value={data.content || ''} onChange={(e) => updateNodeData(id, { content: e.target.value })} style={{ width: '100%', marginTop: '4px', padding: '4px', minHeight: '40px' }} />
    </div>
  );
}