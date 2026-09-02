'use client';

import { useState, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeProps, Node } from '@xyflow/react';

export type HttpRequestNodeData = {
  label?: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: string; // JSON 字符串，如 '{"Content-Type":"application/json"}'
  body: string;    // JSON 字符串，或纯文本
};

export type HttpRequestNodeType = Node<HttpRequestNodeData, 'httpRequestNode'>;

export default function HttpRequestNode({ id, data }: NodeProps<HttpRequestNodeType>) {
  const [method, setMethod] = useState(data.method || 'GET');
  const [url, setUrl] = useState(data.url || '');
  const [headers, setHeaders] = useState(data.headers || '{}');
  const [body, setBody] = useState(data.body || '');
  const { updateNodeData } = useReactFlow();

  const handleMethodChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as HttpRequestNodeData['method'];
    setMethod(val);
    updateNodeData(id, { method: val });
  }, [id, updateNodeData]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    updateNodeData(id, { url: val });
  }, [id, updateNodeData]);

  const handleHeadersChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setHeaders(val);
    updateNodeData(id, { headers: val });
  }, [id, updateNodeData]);

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setBody(val);
    updateNodeData(id, { body: val });
  }, [id, updateNodeData]);

  return (
    <div
      style={{
        background: '#e8f5e9',
        border: '1px solid #43a047',
        borderRadius: '8px',
        padding: '12px 16px',
        minWidth: '280px',
        maxWidth: '320px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />

      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🌐 HTTP 请求</div>

      <div style={{ marginBottom: '6px' }}>
        <label style={{ fontSize: '12px', color: '#555' }}>方法</label>
        <select
          value={method}
          onChange={handleMethodChange}
          style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <label style={{ fontSize: '12px', color: '#555' }}>URL</label>
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="https://api.example.com/data"
          style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
      </div>

      <div style={{ marginBottom: '6px' }}>
        <label style={{ fontSize: '12px', color: '#555' }}>Headers (JSON)</label>
        <textarea
          value={headers}
          onChange={handleHeadersChange}
          placeholder='{"Authorization":"Bearer xxx"}'
          style={{ width: '100%', minHeight: '40px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px', resize: 'vertical' }}
        />
      </div>

      {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
        <div style={{ marginBottom: '6px' }}>
          <label style={{ fontSize: '12px', color: '#555' }}>Body (JSON)</label>
          <textarea
            value={body}
            onChange={handleBodyChange}
            placeholder='{"query": "data"}'
            style={{ width: '100%', minHeight: '50px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px', resize: 'vertical' }}
          />
        </div>
      )}

      <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>ID: {id}</div>
    </div>
  );
}