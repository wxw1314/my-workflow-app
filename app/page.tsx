'use client';

import { useState, useCallback, useRef,useEffect } from 'react';
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
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import InputNode,{type InputNodeData} from './components/InputNode';
import LLMNode, {type LLMNodeData} from './components/LLMNode';
import ConditionNode,{type ConditionNodeData} from './components/ConditionNode'; // 导入条件节点
import HttpRequestNode,{type HttpRequestNodeData} from './components/HttpRequestNode';
import DatabaseQueryNode,{type DatabaseQueryNodeData} from './components/DatabaseQueryNode';
import WeatherNode,{type WeatherNodeData} from './components/WeatherNode';
import NotificationNode,{type NotificationNodeData} from './components/NotificationNode';

// ---------- 类型定义 ----------
type AppNode = Node; // 使用简单类型，避免联合类型问题

// ---------- 注册节点类型 ----------
const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  llmNode: LLMNode,
  conditionNode: ConditionNode, // 注册条件节点
  httpRequestNode: HttpRequestNode,
  databaseNode: DatabaseQueryNode,
  weatherNode: WeatherNode,
  notificationNode: NotificationNode,

};

type NodeDataType =  ConditionNodeData | InputNodeData| LLMNodeData | HttpRequestNodeData | DatabaseQueryNodeData |WeatherNodeData|NotificationNodeData;
// ---------- 初始节点数据 ----------
const initialNodes: AppNode[] = [
  // {
  //   id: 'n1',
  //   type: 'inputNode',
  //   position: { x: 0, y: 0 },
  //   data: { label: '用户输入', value: '请帮我写个总结' },
  // },
  // {
  //   id: 'n2',
  //   type: 'llmNode',
  //   position: { x: 0, y: 500 },
  //   data: { label: '大模型', systemPrompt: '你是一个助理' },
  // },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'n1', target: 'n2' },
];


function WorkflowEditor(){
 const { getNodes, getEdges, deleteElements } = useReactFlow();

  const [nodes, setNodes] = useState<AppNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [result, setResult] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  

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
    // 随机位置（防止重叠）
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
    }else if (type === 'httpRequestNode') {
      nodeData = { label: 'HTTP 请求', method: 'GET', url: '', headers: '{}', body: '' };
    }else if (type === 'databaseNode') {
    nodeData = { label: '查询数据库',table: 'products',idField: 'productId', value: '', };
    } else if (type === 'weatherNode') {
      nodeData = { label: '天气查询', city: '' };
    } else if (type === 'notificationNode') {
      nodeData = { label: '发送通知', recipient: '', subject: '', content: '' };
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
    const selectedNodes = getNodes().filter(n => n.selected);
    const selectedEdges = getEdges().filter(e => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    deleteElements({
      nodes: selectedNodes,
      edges: selectedEdges,
    });
  }, [getNodes, getEdges, deleteElements]);

  // ---------- 键盘监听 ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 将 target 断言为 HTMLElement 或 null
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


  // ---------- 运行工作流（流式） ----------
  const handleRun = async () => {
    const workflowDef = {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
    };
    console.log(JSON.stringify(workflowDef));
    setIsRunning(true);
    setResult('');

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
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setResult(accumulated);
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
              cursor: 'pointer' }}
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
              cursor: 'pointer' }}>
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
            cursor: 'pointer' }}>
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
              cursor: 'pointer' }}>
            📧 通知
          </button>
          {/* 🆕 删除选中按钮 */}
          <button
            onClick={deleteSelected}
            style={{ 
              padding: '8px 16px', 
              background: '#e53935', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' }}
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
      </div>
  );
}

// ---------- 主组件 ----------
export default function Home() {
  return(
  <ReactFlowProvider>
    <WorkflowEditor />
  </ReactFlowProvider>
  )
}