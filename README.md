# my-workflow-app

一个基于 **Next.js 16 + React 19 + React Flow** 的可视化工作流编排工具。用户在画布上拖拽节点、连线组合，即可搭建"输入 → LLM → 条件分支 → HTTP 调用 → 数据库查询 → 通知"这样的自动化流程，后端顺着连线拓扑执行并把结果流式回传到前端。

## 功能

- **可视化画布**：基于 `@xyflow/react` 的节点/连线编辑器，支持拖拽、连线、删除（`Delete` / `Backspace`）。
- **多种节点类型**：
  | 节点 | 类型 | 作用 |
  | --- | --- | --- |
  | 输入节点 | `inputNode` | 工作流的起点，提供用户输入 |
  | LLM 节点 | `llmNode` | 调用 OpenAI 兼容接口生成文本 |
  | 条件分支 | `conditionNode` | 用 `expr-eval` 表达式判断走 `true` / `false` 分支 |
  | HTTP 请求 | `httpRequestNode` | 调用任意外部 REST API |
  | 数据库查询 | `databaseNode` | 通过 `/api/db/query` 查询 MongoDB |
  | 天气查询 | `weatherNode` | 调用和风天气 API，支持中文城市名 |
  | 通知 | `notificationNode` | 通过 `/api/send/email` 发送邮件 |
- **流式执行**：`/api/run-workflow` 以 `ReadableStream` 逐字符返回结果，前端有打字机效果。
- **条件表达式沙箱**：LLM 输出会作为变量 `input` 传入 `expr-eval` 求值，比 `eval` 安全。

## 技术栈

- Next.js 16.3.3（App Router）
- React 19.2.8
- TypeScript 5
- Tailwind CSS 4
- `@xyflow/react` 12 — 画布
- Mongoose 9 — MongoDB ORM
- `expr-eval` — 条件表达式求值

## 环境要求

- Node.js ≥ 20
- MongoDB（本地或 Atlas，需要用到数据库节点时）
- OpenAI 兼容的 LLM API Key（用到 LLM 节点或 Agent 节点时）
- 和风天气 API Key + 项目专属 API Host（用到天气节点时，见下方"环境变量"）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 在项目根目录新建 .env.local，填入下面的环境变量

# 3. 启动开发服务
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可看到画布。

## 环境变量

在项目根目录新建 `.env.local`：

```bash
# ---- MongoDB ----
# 数据库名要显式写在 URI 末尾（否则默认连 test 库）
MONGODB_URI=mongodb://localhost:27017/my-project

# ---- LLM ----
OPENAI_API_KEY=sk-xxx              # 或 DEEPSEEK_API_KEY
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# ---- 天气节点（和风天气 QWeather）----
# 2025 起和风弃用共享域名 devapi/geoapi.qweather.com，
# 必须使用控制台里项目专属的 API Host（形如 xxxxxx.re.qweatherapi.com）。
WEATHER_API_KEY=xxx
QWEATHER_API_HOST=xxxxxx.re.qweatherapi.com

# ---- 内部接口回调（通知节点会用到）----
NEXTAUTH_URL=http://localhost:3000
```

## 常用脚本

```bash
npm run dev     # 开发模式（含热更新）
npm run build   # 生产构建
npm run start   # 启动生产服务
npm run lint    # ESLint 检查
```

## 目录结构

```
app/
  page.tsx                 # 主画布 + 节点/边状态管理
  components/              # 各类节点 UI 组件
    InputNode.tsx
    LLMNode.tsx
    ConditionNode.tsx
    HttpRequestNode.tsx
    DatabaseQueryNode.tsx
    WeatherNode.tsx
    NotificationNode.tsx
  api/
    run-workflow/route.ts  # 核心执行器：按拓扑遍历节点并流式返回
    db/query/route.ts      # MongoDB 查询接口
    search/route.ts        # 搜索接口
    send/
      route.ts
      email/               # 邮件发送
lib/
  mongodb.ts               # Mongoose 连接（带全局缓存，防 HMR 重复连接）
models/
  Product.ts               # 示例 Mongoose 模型
```

## 执行流程

1. 前端 `handleRun` 把画布上的 `nodes / edges` POST 到 `/api/run-workflow`。
2. 后端从 `inputNode` 出发，沿 `edges` 顺序推进 `currentId`。
3. 每类节点按自己的逻辑处理 `previousResult` 并写回，作为下游输入。
4. 条件节点根据 `expr-eval` 计算结果，选择 `sourceHandle === 'true' | 'false'` 的下游边。
5. 最终结果通过 `ReadableStream` 逐字符推给前端。

## 已知注意点

- **和风天气必须用专属 Host**：控制台 → 项目管理里复制专属 API Host 填到 `QWEATHER_API_HOST`，共享域名 `devapi/geoapi.qweather.com` 会直接 404。鉴权用请求头 `X-QW-Api-Key`（代码已封装好）。
- **Agent 节点多工具并行调用**：LLM 返回多个 `tool_calls` 时，代码会并行执行完所有工具再一起回传给 LLM——遵守 OpenAI 协议"每个 `tool_call_id` 都必须有对应 `role:'tool'` 回复"的硬性要求，否则会 400。
- **Mongoose 集合名默认复数小写**：`model('Product', ...)` 对应集合 `products`。如果你的表在 `my-project` 库里叫其它名字，需在 `model` 第三个参数显式指定。
- **`MONGODB_URI` 一定要带库名**，否则默认连 `test`。
- **Next.js 16 有破坏性改动**：写代码前先读 `node_modules/next/dist/docs/` 里的对应文档（详见 `AGENTS.md`）。

## Roadmap

**P1 — 核心能力**
- 代码执行节点：在沙箱（`vm2` / `isolated-vm`）中运行用户自定义 JS/Python
- 循环节点：对数组迭代处理并支持累加器模式

**P2 — 体验与可观测**
- 节点属性面板：点击节点后在侧栏显示表单，替代节点内部堆输入框的做法
- 执行日志：记录每个节点的输入/输出、耗时、错误堆栈
- 子工作流：把工作流封装成可复用的子节点
- 版本管理：保存/加载工作流 JSON，支持历史回滚

**未来探索**
- 并行执行：多分支同时跑，合并结果
- 人机交互节点：工作流暂停等待人工审批
- AI 智能编排：让 LLM 根据任务描述自动生成工作流
- 监控与告警：失败时通知邮件 / 钉钉 / 企业微信
