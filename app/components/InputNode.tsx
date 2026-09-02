import { useState, useCallback, useRef } from 'react';
import { Handle, Position, useReactFlow, NodeProps, Node } from '@xyflow/react';

export type InputNodeData = {
  label?: string;
  value?: string; // 存储文本内容
};

export type InputNodeType = Node<InputNodeData, 'inputNode'>;

export default function InputNode({ id, data }: NodeProps<InputNodeType>) {
  const [value, setValue] = useState(data.value || '');
  const { updateNodeData } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文本区域变化
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    updateNodeData(id, { value: newValue });
  }, [id, updateNodeData]);

  // 文件上传处理
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 简单类型检查：只处理文本类文件
    if (!file.type.startsWith('text/') && !file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      alert('请上传文本文件（.txt, .md 等）');
      return;
    }
    const reader = new FileReader();
   
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setValue(content);
      updateNodeData(id, { value: content });
    };
    reader.onerror = () => alert('读取文件失败，请重试');
    reader.readAsText(file, 'UTF-8');

    // 重置 input 以便重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [id, updateNodeData]);

  return (
    <div style={{ background: '#f0f4ff', border: '1px solid #4f8cf7', borderRadius: '8px', padding: '12px 16px', minWidth: '220px', maxWidth: '320px' }}>
      <Handle type="source" position={Position.Right} id="output" />
      <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>📥 输入节点</span>
      <textarea
        style={{ width: '100%', minHeight: '80px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' }}
        value={value}
        onChange={handleTextChange}
        placeholder="输入或粘贴文本，或上传文件..."
      />
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          onChange={handleFileUpload}
          style={{ fontSize: '12px', flex: 1 }}
        />
        {/* <span style={{ fontSize: '11px', color: '#888' }}>上传文本</span> */}
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>ID: {id}</div>
    </div>
  );
}