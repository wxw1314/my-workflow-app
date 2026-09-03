'use client';
import { useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeProps, Node } from '@xyflow/react';

export type ToolAgentNodeData = {
  label?: string;
  systemPrompt?: string;
  enabledTools: string[]; // ['weather', 'database', 'notification', 'http']
};

export type ToolAgentNodeType = Node<ToolAgentNodeData, 'toolAgentNode'>;

const AVAILABLE_TOOLS = [
  { id: 'weather', label: '☀️ 天气查询', desc: '查询实时天气' },
  { id: 'database', label: '🗄️ 数据库查询', desc: '查询产品信息' },
  { id: 'notification', label: '📧 发送通知', desc: '发送邮件/短信' },
  { id: 'http', label: '🌐 HTTP 请求', desc: '调用任意 REST API' },
];

export default function ToolAgentNode({ id, data }: NodeProps<ToolAgentNodeType>) {
  const [enabledTools, setEnabledTools] = useState<string[]>(data.enabledTools || ['weather', 'database']);
  const [systemPrompt, setSystemPrompt] = useState(data.systemPrompt || '你是一个智能助手，可以调用工具来帮助用户完成任务。');
  const { updateNodeData } = useReactFlow();

  const toggleTool = useCallback((toolId: string) => {
    const newSet = enabledTools.includes(toolId)
      ? enabledTools.filter(t => t !== toolId)
      : [...enabledTools, toolId];
    setEnabledTools(newSet);
    updateNodeData(id, { enabledTools: newSet });
  }, [enabledTools, id, updateNodeData]);

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSystemPrompt(val);
    updateNodeData(id, { systemPrompt: val });
  }, [id, updateNodeData]);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      border: '2px solid #e94560',
      borderRadius: '12px',
      padding: '16px',
      minWidth: '240px',
      maxWidth: '320px',
      color: 'white',
      boxShadow: '0 4px 20px rgba(233, 69, 96, 0.3)',
    }}>
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />

      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#e94560', marginBottom: '8px' }}>
        🧠 智能代理
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '12px', color: '#aaa', display: 'block' }}>系统提示</label>
        <textarea
          value={systemPrompt}
          onChange={handlePromptChange}
          placeholder="设置 Agent 的角色和指令..."
          style={{
            width: '100%',
            minHeight: '40px',
            padding: '4px 6px',
            borderRadius: '4px',
            border: '1px solid #444',
            background: '#2a2a4a',
            color: 'white',
            fontSize: '12px',
            resize: 'vertical',
            fontFamily: 'monospace',
          }}
        />
      </div>

      <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
        可用工具（点击切换）
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {AVAILABLE_TOOLS.map(tool => (
          <span
            key={tool.id}
            onClick={() => toggleTool(tool.id)}
            style={{
              padding: '2px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              cursor: 'pointer',
              background: enabledTools.includes(tool.id) ? '#e94560' : '#2a2a4a',
              border: enabledTools.includes(tool.id) ? '1px solid #e94560' : '1px solid #555',
              color: 'white',
              transition: 'all 0.2s',
            }}
          >
            {tool.label}
          </span>
        ))}
      </div>

      <div style={{ fontSize: '10px', color: '#666', marginTop: '8px' }}>
        已启用: {enabledTools.join(', ') || '无'}
      </div>
    </div>
  );
}