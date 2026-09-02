import { useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeProps, Node } from '@xyflow/react';

export type LLMNodeData = {
  label?: string;
  systemPrompt?: string;
};

export type LLMNodeType = Node<LLMNodeData, 'llmNode'>;

export default function LLMNode({ id, data }: NodeProps<LLMNodeType>) {
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '');
  const { updateNodeData } = useReactFlow();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setSystemPrompt(newValue);
    updateNodeData(id, { systemPrompt: newValue });
  }, [id, updateNodeData]);

  return (
    <div style={{ background: '#fff7ed', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px 16px', minWidth: '200px' }}>
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
      <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>🤖 大模型节点</span>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>System Prompt:</div>
      <textarea
        style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' }}
        rows={3}
        value={systemPrompt}
        onChange={handleChange}
        placeholder="请输入系统提示词..."
      />
      <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>ID: {id}</div>
    </div>
  );
}
