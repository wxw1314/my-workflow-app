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
    method?: string;
    url?: string;
    headers?: string;
    body?: string;
    table?: string;
    idField?: string;
    queryId?: string;    // 数据库查询用
    city?: string;
    recipient?: string;
    subject?: string;
    content?: string;
    enabledTools?: string[];      // 智能代理用
    [key: string]: any;
  };
}

interface WorkflowEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

// ---------- 条件评估 ----------
const parser = new Parser();

function evaluateCondition(input: string, conditionExpr: string): boolean {
  try {
    const result = parser.evaluate(conditionExpr, { input });
    return !!result;
  } catch (error) {
    console.error('条件评估错误:', error);
    return false;
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

// ---------- 和风天气查询（中文城市名 → 天气）----------
// 2025 起和风弃用共享域名 devapi/geoapi.qweather.com，
// 必须使用项目专属 API Host（形如 xxxxxx.re.qweatherapi.com），
// 在 .env.local 里设 QWEATHER_API_HOST 传入。
// 鉴权用 X-QW-Api-Key 请求头，不再是 URL 参数。
async function fetchQWeather(city: string, apiKey: string): Promise<{
  ok: true;
  city: string;
  text: string;
  temp: string;
  raw: any;
} | { ok: false; error: string }> {
  const host = process.env.QWEATHER_API_HOST;
  if (!host) {
    return { ok: false, error: '未配置 QWEATHER_API_HOST（去和风控制台复制专属 API Host）' };
  }
  // 允许配置带或不带协议头，统一补 https
  const base = host.startsWith('http') ? host : `https://${host}`;
  const headers = { 'X-QW-Api-Key': apiKey };

  // 1. 中文城市 → locationId（GeoAPI 现在也走专属 host）
  const geoRes = await fetch(
    `${base}/geo/v2/city/lookup?location=${encodeURIComponent(city)}`,
    { headers }
  );
  if (!geoRes.ok) {
    return { ok: false, error: `GeoAPI HTTP ${geoRes.status}` };
  }
  const geoData = await geoRes.json();
  if (geoData.code !== '200' || !geoData.location?.length) {
    return { ok: false, error: `找不到城市 "${city}"（code=${geoData.code}）` };
  }
  const locationId = geoData.location[0].id;
  const matchedName = geoData.location[0].name;

  // 2. locationId → 实时天气
  const wRes = await fetch(
    `${base}/v7/weather/now?location=${locationId}&lang=zh`,
    { headers }
  );
  if (!wRes.ok) {
    return { ok: false, error: `WeatherAPI HTTP ${wRes.status}` };
  }
  const wData = await wRes.json();
  if (wData.code !== '200') {
    return { ok: false, error: `天气查询失败 code=${wData.code}` };
  }
  return {
    ok: true,
    city: matchedName,
    text: wData.now.text,
    temp: wData.now.temp,
    raw: wData,
  };
}

// ---------- 执行工具（智能代理用） ----------
async function executeTool(
  toolName: string,
  args: any,
  logLines: any[]
): Promise<string> {
  let toolResult = '';

  switch (toolName) {
    case 'get_weather': {
      const weatherApiKey = process.env.WEATHER_API_KEY;
      if (!weatherApiKey) {
        toolResult = '错误：未配置天气 API 密钥';
        break;
      }
      const result = await fetchQWeather(args.city, weatherApiKey);
      if (result.ok) {
        toolResult = `当前${result.city}天气：${result.text}，温度 ${result.temp}°C`;
      } else {
        toolResult = `天气查询失败：${result.error}`;
      }
      break;
    }

    case 'query_database': {
      try {
        await dbConnect();
        const query = args.query || args.productId || args.id;
        if (!query) {
          toolResult = '错误：未提供查询条件';
          break;
        }
        // 尝试按 productId 或 title 查询
        let result = await Product.findOne({
          $or: [
            { productId: isNaN(Number(query)) ? undefined : Number(query) },
            { title: { $regex: query, $options: 'i' } }
          ]
        }).lean();

        if (!result) {
          const all = await Product.find({}).limit(10).lean();
          toolResult = `未找到匹配 "${query}" 的产品，以下为前 10 条记录：\n${JSON.stringify(all, null, 2)}`;
        } else {
          toolResult = `查询结果：\n${JSON.stringify(result, null, 2)}`;
        }
      } catch (err: any) {
        toolResult = `数据库查询失败：${err.message}`;
      }
      break;
    }

    case 'send_notification': {
      try {
        // 模拟发送通知，实际可接入邮件/SMTP
        console.log('📧 发送通知:', {
          to: args.recipient,
          subject: args.subject,
          content: args.content,
        });
        toolResult = `通知已发送至 ${args.recipient}（模拟）`;
      } catch (err: any) {
        toolResult = `通知发送失败：${err.message}`;
      }
      break;
    }

    case 'http_request': {
      try {
        const headers = args.headers ? JSON.parse(args.headers) : {};
        const res = await fetch(args.url, {
          method: args.method || 'GET',
          headers,
          body: args.body || undefined,
        });
        const data = await res.json();
        toolResult = `HTTP 响应：\n${JSON.stringify(data, null, 2)}`;
      } catch (err: any) {
        toolResult = `HTTP 请求失败：${err.message}`;
      }
      break;
    }

    default:
      toolResult = `未知工具：${toolName}`;
  }

  // 记录工具结果日志
  logLines.push({
    type: 'tool_result',
    timestamp: Date.now(),
    tool: toolName,
    result: toolResult,
  });

  return toolResult;
}

// ---------- POST 处理 ----------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodes, edges } = body as { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

    const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]));

    const startNode = nodes.find((n) => n.type === 'inputNode');
    if (!startNode) {
      return new Response('未找到输入节点', { status: 400 });
    }

    let currentId: string | null = startNode.id;
    let previousResult = '';

    // ---------- 日志收集 ----------
    const logLines: any[] = [];
    logLines.push({
      type: 'system',
      timestamp: Date.now(),
      message: '🚀 开始执行工作流',
    });

    while (currentId !== null) {
      const currentNode = nodeMap.get(currentId);
      if (!currentNode) break;

      // ---------- 节点执行 ----------
      if (currentNode.type === 'inputNode') {
        previousResult = currentNode.data.value || '';
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `📥 输入节点：${previousResult.slice(0, 50)}${previousResult.length > 50 ? '...' : ''}`,
        });
      } 
      else if (currentNode.type === 'llmNode') {
        const systemPrompt = currentNode.data.systemPrompt || '你是一个智能助理';
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `🧠 调用 LLM...`,
        });
        previousResult = await callLLMNonStream(systemPrompt, previousResult);
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `✅ LLM 响应完成（${previousResult.length} 字符）`,
        });
      } 
      else if (currentNode.type === 'conditionNode') {
        const conditionExpr = currentNode.data.condition || 'false';
        const result = evaluateCondition(previousResult, conditionExpr);
        const handleId = result ? 'true' : 'false';
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `🔀 条件分支：${conditionExpr} → ${result ? 'true ✅' : 'false ❌'}`,
        });
        const nextEdge = edges.find((e) => e.source === currentId && e.sourceHandle === handleId);
        currentId = nextEdge ? nextEdge.target : null;
        continue;
      } 
      else if (currentNode.type === 'httpRequestNode') {
        const { method, url, headers, body } = currentNode.data;
        if (!url) {
          throw new Error('HTTP 请求节点缺少 URL');
        }
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `🌐 HTTP ${method} ${url}`,
        });
        let parsedHeaders = {};
        try {
          parsedHeaders = JSON.parse(headers || '{}');
        } catch {}
        const fetchOptions: RequestInit = {
          method: method || 'GET',
          headers: parsedHeaders,
        };
        if (['POST', 'PUT', 'PATCH'].includes(method as string) && body) {
          fetchOptions.body = body;
        }
        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
          throw new Error(`HTTP 请求失败: ${response.status}`);
        }
        const contentType = response.headers.get('content-type');
        let responseData: string;
        if (contentType && contentType.includes('application/json')) {
          const json = await response.json();
          responseData = JSON.stringify(json);
        } else {
          responseData = await response.text();
        }
        previousResult = responseData;
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `✅ HTTP 请求完成（${response.status}）`,
        });
      } 
      else if (currentNode.type === 'databaseNode') {
        const { table, idField, queryId } = currentNode.data;  // 使用 queryId
        const payload = {
          table: table || 'products',
          idField: idField || 'productId',
          queryId: queryId || null
        };
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `🗄️ 查询数据库：${table} (${idField}: ${queryId || '全部'})`,
        });
        try {
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
          previousResult = JSON.stringify(data);
          logLines.push({
            type: 'node',
            timestamp: Date.now(),
            message: `✅ 数据库查询完成（${JSON.stringify(data).length} 字符）`,
          });
        } catch (dbError: any) {
          logLines.push({
            type: 'error',
            timestamp: Date.now(),
            message: `❌ 数据库查询失败：${dbError.message}`,
          });
          previousResult = JSON.stringify({ error: dbError.message });
        }
      } 
      else if (currentNode.type === 'weatherNode') {
        const { city } = currentNode.data;
        const API_KEY = process.env.WEATHER_API_KEY;
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `☀️ 查询天气：${city}`,
        });
        if (!API_KEY || !city) {
          previousResult = JSON.stringify({ error: '缺少城市或 API 密钥' });
        } else {
          const result = await fetchQWeather(city, API_KEY);
          if (result.ok) {
            previousResult = JSON.stringify({
              city: result.city,
              text: result.text,
              temp: result.temp,
              raw: result.raw,
            });
            logLines.push({
              type: 'node',
              timestamp: Date.now(),
              message: `✅ 天气查询完成：${result.text}`,
            });
          } else {
            previousResult = JSON.stringify({ error: result.error });
            logLines.push({
              type: 'error',
              timestamp: Date.now(),
              message: `❌ 天气查询失败：${result.error}`,
            });
          }
        }
      }
      else if (currentNode.type === 'notificationNode') {
        const { recipient, subject, content } = currentNode.data;
        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `📧 发送通知至：${recipient}`,
        });
        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          const res = await fetch(`${baseUrl}/api/send/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: recipient, subject, text: content }),
          });
          const data = await res.json();
          previousResult = JSON.stringify(data);
          logLines.push({
            type: 'node',
            timestamp: Date.now(),
            message: `✅ 通知发送${data.success ? '成功' : '失败'}`,
          });
        } catch (err: any) {
          logLines.push({
            type: 'error',
            timestamp: Date.now(),
            message: `❌ 通知发送失败：${err.message}`,
          });
          previousResult = JSON.stringify({ error: err.message });
        }
      }
      // ---------- 🆕 智能代理节点（Function Calling） ----------
      else if (currentNode.type === 'toolAgentNode') {
        const userQuery = previousResult;
        const systemPrompt = currentNode.data.systemPrompt || '你是一个智能助手，可以调用工具来帮助用户完成任务。';
        const enabledTools = currentNode.data.enabledTools || ['weather', 'database'];

        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `🧠 智能代理开始处理：${userQuery.slice(0, 50)}${userQuery.length > 50 ? '...' : ''}`,
        });

        // 1. 构建工具 Schema
        const tools = [];
        if (enabledTools.includes('weather')) {
          tools.push({
            type: 'function',
            function: {
              name: 'get_weather',
              description: '查询指定城市的实时天气',
              parameters: {
                type: 'object',
                properties: {
                  city: { type: 'string', description: '城市名称，如 Beijing、Shanghai' }
                },
                required: ['city']
              }
            }
          });
        }
        if (enabledTools.includes('database')) {
          tools.push({
            type: 'function',
            function: {
              name: 'query_database',
              description: '查询产品信息，通过产品ID、名称或关键词',
              parameters: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: '产品ID、名称或关键词' }
                },
                required: ['query']
              }
            }
          });
        }
        if (enabledTools.includes('notification')) {
          tools.push({
            type: 'function',
            function: {
              name: 'send_notification',
              description: '发送邮件或短信通知',
              parameters: {
                type: 'object',
                properties: {
                  recipient: { type: 'string', description: '收件人邮箱或手机号' },
                  subject: { type: 'string', description: '通知标题' },
                  content: { type: 'string', description: '通知内容' }
                },
                required: ['recipient', 'subject', 'content']
              }
            }
          });
        }
        if (enabledTools.includes('http')) {
          tools.push({
            type: 'function',
            function: {
              name: 'http_request',
              description: '发起 HTTP 请求调用外部 API',
              parameters: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: '请求的 URL 地址' },
                  method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP 方法' },
                  headers: { type: 'string', description: '请求头，JSON 格式' },
                  body: { type: 'string', description: '请求体，JSON 格式' }
                },
                required: ['url', 'method']
              }
            }
          });
        }

        // 2. 调用 LLM（带工具）
        const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
        const baseURL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
        const model = process.env.LLM_MODEL || 'gpt-4o-mini';

        let llmRes = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userQuery }
            ],
            tools: tools.length > 0 ? tools : undefined,
            tool_choice: 'auto',
          }),
        });

        if (!llmRes.ok) {
          throw new Error(`LLM API error: ${llmRes.status}`);
        }

        const llmData = await llmRes.json();
        const message = llmData.choices[0].message;

        console.log(message);

        // 3. 如果有工具调用，先并行执行全部工具，再一次性回传给 LLM
        //    OpenAI 协议要求：assistant 消息里每个 tool_call_id 都必须
        //    有对应的 role:'tool' 回复，缺一个就 400。
        if (message.tool_calls && message.tool_calls.length > 0) {
          const toolMessages = await Promise.all(
            message.tool_calls.map(async (toolCall: any) => {
              const functionName = toolCall.function.name;
              const args = JSON.parse(toolCall.function.arguments);

              logLines.push({
                type: 'tool_call',
                timestamp: Date.now(),
                tool: functionName,
                args,
              });

              const toolResult = await executeTool(functionName, args, logLines);
              return {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                content: toolResult,
              };
            })
          );

          const finalRes = await fetch(`${baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userQuery },
                message,
                ...toolMessages,
              ],
            }),
          });

          if (!finalRes.ok) {
            const errText = await finalRes.text();
            throw new Error(`LLM final API error: ${finalRes.status} ${errText}`);
          }

          const finalData = await finalRes.json();
          previousResult = finalData.choices[0].message.content;

          logLines.push({
            type: 'final_answer',
            timestamp: Date.now(),
            message: previousResult,
          });
        } else {
          previousResult = message.content || '（无响应）';
          logLines.push({
            type: 'final_answer',
            timestamp: Date.now(),
            message: previousResult,
          });
        }

        logLines.push({
          type: 'node',
          timestamp: Date.now(),
          message: `✅ 智能代理处理完成`,
        });
      }

      // ---------- 普通节点（非条件）查找下一条边 ----------
      const nextEdge = edges.find((e) => 
        e.source === currentId && 
        (!e.sourceHandle || e.sourceHandle === 'output')
      );
      currentId = nextEdge ? nextEdge.target : null;
    }

    // 记录结束
    logLines.push({
      type: 'system',
      timestamp: Date.now(),
      message: '🏁 工作流执行完成',
    });

    // ---------- 构造流式响应（先发日志，再发结果） ----------
    const finalText = previousResult || '（无输出结果）';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // 1. 发送所有日志
        for (const log of logLines) {
          const line = `[LOG]${JSON.stringify(log)}\n`;
          controller.enqueue(encoder.encode(line));
          await new Promise(resolve => setTimeout(resolve, 5));
        }

        // 2. 发送结果前缀
        controller.enqueue(encoder.encode('[RESULT]'));

        // 3. 逐字符发送最终结果（打字机效果）
        for (const char of finalText) {
          controller.enqueue(encoder.encode(char));
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        controller.enqueue(encoder.encode('\n[DONE]'));
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
    console.error('工作流执行错误:', error);
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return new Response(
      `[LOG]${JSON.stringify({ type: 'error', message: `❌ 服务器错误：${errorMsg}` })}\n[RESULT]错误：${errorMsg}`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    );
  }
}