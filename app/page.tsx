'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import InputNode, { type InputNodeData } from './components/InputNode';
import LLMNode, { type LLMNodeData } from './components/LLMNode';
import ConditionNode, { type ConditionNodeData } from './components/ConditionNode';
import HttpRequestNode, { type HttpRequestNodeData } from './components/HttpRequestNode';
import DatabaseQueryNode, { type DatabaseQueryNodeData } from './components/DatabaseQueryNode';
import WeatherNode, { type WeatherNodeData } from './components/WeatherNode';
import NotificationNode, { type NotificationNodeData } from './components/NotificationNode';
import ToolAgentNode, { type ToolAgentNodeData } from './components/ToolAgentNode';

// ---------- 类型定义 ----------
type AppNode = Node;

// ---------- 注册节点类型 ----------
const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  llmNode: LLMNode,
  conditionNode: ConditionNode,
  httpRequestNode: HttpRequestNode,
  databaseNode: DatabaseQueryNode,
  weatherNode: WeatherNode,
  notificationNode: NotificationNode,
  toolAgentNode: ToolAgentNode,
};

type NodeDataType =
  | ConditionNodeData
  | InputNodeData
  | LLMNodeData
  | HttpRequestNodeData
  | DatabaseQueryNodeData
  | WeatherNodeData
  | NotificationNodeData
  | ToolAgentNodeData;

// ---------- 初始节点数据 ----------
const initialNodes: AppNode[] = [];

const initialEdges: Edge[] = [];

// ---------- 工具函数：格式化日志 ----------
function formatLog(log: any): string {
  const time = new Date(log.timestamp).toLocaleTimeString();
  switch (log.type) {
    case 'system':
      return `[${time}] ⚙️ ${log.message}`;
    case 'node':
      return `[${time}] 📍 ${log.message}`;
    case 'tool_call':
      return `[${time}] 🔧 调用工具: ${log.tool}(${JSON.stringify(log.args)})`;
    case 'tool_result':
      return `[${time}] ✅ 工具返回: ${log.result?.slice(0, 100)}${log.result?.length > 100 ? '...' : ''}`;
    case 'final_answer':
      return `[${time}] 💬 ${log.message?.slice(0, 80)}${log.message?.length > 80 ? '...' : ''}`;
    case 'error':
      return `[${time}] ❌ ${log.message}`;
    default:
      return `[${time}] 📋 ${JSON.stringify(log)}`;
  }
}

// ---------- 工作流编辑器 ----------
function WorkflowEditor() {
  const { getNodes, getEdges, deleteElements } = useReactFlow();

  const [nodes, setNodes] = useState<AppNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [result, setResult] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // ---------- 🆕 日志状态 ----------
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(true);

  // ---------- React Flow 事件处理器 ----------
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  // ---------- 添加节点 ----------
  const onAddNode = useCallback((type: string) => {
    const position = {
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 300,
    };
    const newNodeId = `${type}-${Date.now()}`;

    let nodeData: NodeDataType = {};
    if (type === 'inputNode') {
      nodeData = { label: '输入节点', value: '' };
    } else if (type === 'llmNode') {
      nodeData = { label: 'LLM 节点', systemPrompt: '你是一个智能助理' };
    } else if (type === 'conditionNode') {
      nodeData = { label: '条件分支', condition: 'input.length > 0' };
    } else if (type === 'httpRequestNode') {
      nodeData = { label: 'HTTP 请求', method: 'GET', url: '', headers: '{}', body: '' };
    } else if (type === 'databaseNode') {
      nodeData = { label: '查询数据库', table: 'products', idField: 'productId', value: '' };
    } else if (type === 'weatherNode') {
      nodeData = { label: '天气查询', city: '' };
    } else if (type === 'notificationNode') {
      nodeData = { label: '发送通知', recipient: '', subject: '', content: '' };
    } else if (type === 'toolAgentNode') {
      nodeData = {
        label: '智能代理',
        systemPrompt: '你是一个智能助手，可以调用工具来帮助用户完成任务。',
        enabledTools: ['weather', 'database'],
      };
    }

    const newNode: Node = {
      id: newNodeId,
      type: type,
      position,
      data: nodeData,
    };

    setNodes((nds) => nds.concat(newNode));
  }, []);

  // ---------- 删除选中的节点和边 ----------
  const deleteSelected = useCallback(() => {
    const selectedNodes = getNodes().filter((n) => n.selected);
    const selectedEdges = getEdges().filter((e) => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    deleteElements({
      nodes: selectedNodes,
      edges: selectedEdges,
    });
  }, [getNodes, getEdges, deleteElements]);

  // ---------- 键盘监听 ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        target &&
        !target.closest('input') &&
        !target.closest('textarea')
      ) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelected]);

  // ---------- 🆕 运行工作流（流式 + 日志） ----------
  const handleRun = async () => {
    const workflowDef = {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
    };
    console.log(JSON.stringify(workflowDef));

    setIsRunning(true);
    setResult('');
    setLogs([]); // 清空旧日志

    try {
      const response = await fetch('/api/run-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowDef),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`请求失败: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedResult = '';
      let isResultStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('[LOG]')) {
            try {
              const logData = JSON.parse(line.slice(5));
              const formatted = formatLog(logData);
              setLogs((prev) => [...prev, formatted]);
            } catch (e) {
              // 解析失败，直接显示原始内容
              setLogs((prev) => [...prev, `📋 ${line.slice(5)}`]);
            }
          } else if (line.startsWith('[RESULT]')) {
            isResultStarted = true;
            const content = line.slice(8);
            accumulatedResult += content;
            setResult(accumulatedResult);
          } else if (line === '[DONE]') {
            // 结束标记
          } else if (isResultStarted) {
            // 如果在结果开始后还有额外内容（由于流式分块可能产生）
            accumulatedResult += line;
            setResult(accumulatedResult);
          }
        }
      }
    } catch (error) {
      console.error(error);
      setResult(`❌ 执行出错: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // ---------- 渲染 ----------
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* 画布 */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      />

      {/* 添加节点按钮组 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10,
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        {/* ... 已有的按钮保持不变 ... */}
        <button
          onClick={() => onAddNode('inputNode')}
          style={{
            padding: '8px 16px',
            background: '#4f8cf7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ➕ 输入节点
        </button>
        <button
          onClick={() => onAddNode('llmNode')}
          style={{
            padding: '8px 16px',
            background: '#9b6ff0',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ➕ LLM 节点
        </button>
        <button
          onClick={() => onAddNode('conditionNode')}
          style={{
            padding: '8px 16px',
            background: '#ff9800',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🔀 条件分支
        </button>
        <button
          onClick={() => onAddNode('httpRequestNode')}
          style={{
            padding: '8px 16px',
            background: '#43a047',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🌐 HTTP 请求
        </button>
        <button
          onClick={() => onAddNode('databaseNode')}
          style={{
            padding: '8px 16px',
            background: '#1e88e5',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🗄️ 数据库
        </button>
        <button
          onClick={() => onAddNode('weatherNode')}
          style={{
            padding: '8px 16px',
            background: '#fb8c00',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ☀️ 天气
        </button>
        <button
          onClick={() => onAddNode('notificationNode')}
          style={{
            padding: '8px 16px',
            background: '#d81b60',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          📧 通知
        </button>
        <button
          onClick={() => onAddNode('toolAgentNode')}
          style={{
            padding: '8px 16px',
            background: '#e94560',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🧠 智能代理
        </button>
        <button
          onClick={deleteSelected}
          style={{
            padding: '8px 16px',
            background: '#e53935',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🗑️ 删除选中
        </button>
      </div>

      {/* 运行按钮 */}
      <button
        onClick={handleRun}
        disabled={isRunning}
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          padding: '10px 24px',
          background: isRunning ? '#ccc' : '#4f8cf7',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 12px rgba(79,140,247,0.4)',
          zIndex: 10,
        }}
      >
        {isRunning ? '运行中...' : '▶ 运行工作流'}
      </button>

      {/* 结果显示区域 */}
      <div
        style={{
          position: 'absolute',
          bottom: '100px',
          left: '20px',
          maxWidth: '600px',
          minWidth: '300px',
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid #e0e0e0',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 10,
        }}
      >
        <strong style={{ display: 'block', marginBottom: '8px' }}>📝 结果：</strong>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {result || '等待执行...'}
        </div>
      </div>

      {/* 🆕 执行日志面板 */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          right: '20px',
          width: '420px',
          maxHeight: '300px',
          background: '#1a1a2e',
          color: '#e0e0e0',
          borderRadius: '12px',
          padding: '12px 16px',
          overflow: 'hidden',
          zIndex: 10,
          fontSize: '12px',
          fontFamily: 'monospace',
          border: '1px solid #333',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          transition: 'all 0.3s',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: '1px solid #333',
            paddingBottom: '6px',
          }}
        >
          <strong style={{ color: '#e94560' }}>🤖 执行日志</strong>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setLogs([])}
              style={{
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#2a2a4a',
              }}
            >
              清空
            </button>
            <button
              onClick={() => setShowLogs(!showLogs)}
              style={{
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#2a2a4a',
              }}
            >
              {showLogs ? '📕 收起' : '📖 展开'}
            </button>
          </div>
        </div>

        {showLogs && (
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ color: '#555', textAlign: 'center', padding: '20px 0' }}>
                等待执行...
              </div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '3px 0',
                    borderBottom: '1px solid #222',
                    fontSize: '11px',
                    lineHeight: '1.5',
                    wordBreak: 'break-all',
                    color: log.includes('❌')
                      ? '#ff6b6b'
                      : log.includes('✅')
                      ? '#69db7c'
                      : log.includes('🔧')
                      ? '#ffd43b'
                      : log.includes('💬')
                      ? '#74c0fc'
                      : '#e0e0e0',
                  }}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- 主组件 ----------
export default function Home() {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
}