import { NextRequest } from 'next/server';
import { Parser } from 'expr-eval';
import dbConnect from '@/lib/mongodb';
import Product, { IProduct } from '@/models/Product';
// ---------- 类型定义 ----------
interface WorkflowNode {
  id: string;
  type: string;
  data: {
    value?: string;
    systemPrompt?: string;
    condition?: string;
    [key: string]: any;
  };
}

interface WorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string; // 用于条件分支
}

// ---------- 条件评估（使用 expr-eval） ----------
const parser = new Parser();

function evaluateCondition(input: string, conditionExpr: string): boolean {
  try {
    // 只暴露 input 变量给表达式
    const result = parser.evaluate(conditionExpr, { input });
    return !!result; // 转为布尔值
  } catch (error) {
    console.error('条件评估错误:', error);
    return false; // 出错时默认走 false 分支
  }
}

// ---------- 非流式 LLM 调用 ----------
async function callLLMNonStream(systemPrompt: string, userInput: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ---------- POST 处理 ----------
export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体，并断言类型
    const body = await request.json();
    const { nodes, edges } = body as { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

    // 2. 构建节点映射
    const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

    // 3. 找到起始节点
    const startNode = nodes.find((n) => n.type === 'inputNode');
    if (!startNode) {
      return new Response('未找到输入节点', { status: 400 });
    }

    // 4. 执行工作流
    let currentId: string | null = startNode.id;
    let previousResult = '';

    while (currentId !== null) {
      const currentNode = nodeMap.get(currentId);
      if (!currentNode) break;

      // ---------- 节点执行 ----------
      if (currentNode.type === 'inputNode') {
        previousResult = currentNode.data.value || '';
      } else if (currentNode.type === 'llmNode') {
        const systemPrompt = currentNode.data.systemPrompt || '你是一个智能助理';
        previousResult = await callLLMNonStream(systemPrompt, previousResult);
      } else if (currentNode.type === 'conditionNode') {
        const conditionExpr = currentNode.data.condition || 'false';
        const result = evaluateCondition(previousResult, conditionExpr);
        const handleId = result ? 'true' : 'false';
        const nextEdge = edges.find((e) => e.source === currentId && e.sourceHandle === handleId);
        currentId = nextEdge ? nextEdge.target : null;
        continue;
      }else if (currentNode.type === 'httpRequestNode') {
        const { method, url, headers, body } = currentNode.data;
        if (!url) {
          throw new Error('HTTP 请求节点缺少 URL');
        }
        // 解析 headers JSON
        let parsedHeaders = {};
        try {
          parsedHeaders = JSON.parse(headers || '{}');
        } catch {
          // 忽略
        }
        // 准备请求选项
        const fetchOptions: RequestInit = {
          method: method || 'GET',
          headers: parsedHeaders,
        };
        // 对于 POST/PUT/PATCH，添加 body
        if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
          fetchOptions.body = body;
        }
        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
          throw new Error(`HTTP 请求失败: ${response.status}`);
        }
        // 尝试解析为 JSON，否则作为文本
        const contentType = response.headers.get('content-type');
        let responseData: string;
        if (contentType && contentType.includes('application/json')) {
          const json = await response.json();
          responseData = JSON.stringify(json);
        } else {
          responseData = await response.text();
        }
        previousResult = responseData;
      } else if (currentNode.type === 'databaseNode') {
        const { table, idField,value } = currentNode.data;

        // 构造请求体，注意接口接收的字段是 productId（而非 queryId）
        const payload = {
          table: table || 'products',
          idField: idField || 'productId', 
          value: value|| null
        };

        try {
          // 调用内部 API（使用绝对 URL，方便部署）
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          const response = await fetch(`${baseUrl}/api/db/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`数据库查询失败: ${response.status} ${errorText}`);
          }

          const data = await response.json();
          console.log(data);
          previousResult = JSON.stringify(data);
        } catch (dbError) {
          console.error('数据库查询节点执行失败:', dbError);
          previousResult = JSON.stringify({ error: '数据库查询异常' });
          // 可根据需要决定是否中断工作流，这里选择将错误信息作为结果传递给下游
        }


      } else if (currentNode.type === 'weatherNode') {
        const { city } = currentNode.data;
        const API_KEY = process.env.WEATHER_API_KEY; // 存后端环境变量
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric&lang=zh_cn`;
        const res = await fetch(url);
        const data = await res.json();
        previousResult = JSON.stringify(data);

      } else if (currentNode.type === 'notificationNode') {
        const { recipient, subject, content } = currentNode.data;
        // 调用内部的邮件/短信发送接口
        const res = await fetch(`${process.env.NEXTAUTH_URL}/api/send/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: recipient, subject, text: content })
        });
        previousResult = await res.text(); // "发送成功"
      }

      // ---------- 普通节点（非条件）查找下一条边 ----------
      const nextEdge = edges.find((e) => 
        e.source === currentId && 
        (!e.sourceHandle || e.sourceHandle === 'output')
      );
      currentId = nextEdge ? nextEdge.target : null;
    }

    // 5. 流式返回最终结果
    const text = previousResult || '（无输出结果）';
    const stream = new ReadableStream({
      async start(controller) {
        for (const char of text) {
          controller.enqueue(new TextEncoder().encode(char));
          await new Promise((resolve) => setTimeout(resolve, 10)); // 打字机效果
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response('Server Error', { status: 500 });
  }
}