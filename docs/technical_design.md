# AI 语音语义理解模块 - 技术设计说明书

## 1. 系统概述

本项目旨在构建一个支持多模态交互、多模型路由的智能语音语义理解系统。系统核心能力包括指令解析、RAG 知识库问答、实时联网搜索以及通用闲聊。

## 2. 架构升级 (v2.0)

### 2.1 管理后台 (Admin Dashboard)
新增基于 Web 的管理后台，采用 **Manus Design Style** (极简、深色模式、高效交互)。

*   **聊天调试台**: 
    *   支持会话隔离。
    *   **Traceability**: 每一条回复顶部显示来源标签（如 `指令: Qwen-Max` | `RAG: GPT-4o` | `Search: DuckDuckGo`）。
    *   支持流式/非流式切换。
*   **知识库管理**: 支持文件上传、分块预览、向量化状态监控。
*   **指令管理**: 支持 Excel 批量导入指令定义。
*   **批量评测**: 支持 Excel 上传测试集，自动运行并生成评测报告。

### 2.2 联网搜索 (Web Search)
引入实时搜索能力，用于回答天气、新闻等时效性问题。

*   **策略模式**: 支持多种搜索源切换。
    *   `DuckDuckGo` (默认，无需 Key)
    *   `Tavily` (需配置 API Key)
    *   `Serper` (需配置 API Key)
*   **配置**: 通过 `.env` 中的 `SEARCH_PROVIDER` 和对应 Key 进行控制。

---

## 3. 数据接口规范

### 3.1 聊天接口 (Chat Completion)

**Endpoint**: `POST /api/v1/chat/completions`

**Request**:
```json
{
  "query": "北京今天天气怎么样？",
  "session_id": "sess_001",
  "user_id": "user_123",
  "stream": true  // 新增：流式开关
}
```

**Response (Non-stream)**:
```json
{
  "content": "北京今天天气晴朗，气温 25 度...",
  "metadata": {
    "trace_id": "uuid-xxx",
    "route": "chat_search", // instruction / rag / chat / chat_search
    "models_used": {
      "router": "gpt-4o-mini",
      "executor": "qwen-max"
    },
    "latency": {
      "ttft_ms": 120, // 首字耗时
      "total_ms": 1500
    },
    "search_results": [
      {"title": "北京天气", "url": "...", "snippet": "..."}
    ],
    "rag_references": []
  }
}
```

### 3.2 批量评测 Excel 格式

**输入列 (Input Columns)**:
*   `case_id`: 用例编号
*   `query`: 用户提问
*   `expected_intent`: 期望意图 (`instruction`, `rag`, `chat`)
*   `expected_keywords`: 期望关键词 (逗号分隔)

**输出列 (Output Columns - 系统回填)**:
*   `case_id`: (复制输入)
*   `query`: (复制输入)
*   `expected_intent`: (复制输入)
*   `expected_keywords`: (复制输入)
*   `actual_intent`: 实际识别意图
*   `actual_response`: 系统回复内容
*   `provider`: 模型提供商 (e.g., `qwen`)
*   `model_name`: 模型名称 (e.g., `qwen-max`)
*   `ttft_ms`: 首字耗时 (Time to First Token)
*   `total_latency_ms`: 总耗时
*   `status`: `PASS` / `FAIL`

### 3.3 指令导入 Excel 格式

*   `name`: 指令英文标识 (e.g., `set_temperature`)
*   `description`: 指令描述
*   `parameters_json`: JSON Schema 格式的参数定义
    *   Example: `{"temp": {"type": "integer", "minimum": 0}}`
*   `response_template`: 执行成功后的默认回复模板

---

## 4. 数据库设计变更

### 4.1 Redis
*   新增 `search_cache:{query_hash}`: 缓存搜索结果，TTL 10分钟。

### 4.2 PostgreSQL
*   新增 `eval_runs` 表: 记录评测任务元数据。
*   新增 `eval_results` 表: 记录单条评测结果。

---

## 5. 前端设计规范 (Manus Style)

*   **配色**: 深色背景 (`#0A0A0A`), 强调色 (`#3B82F6` 或自定义), 文本 (`#E5E5E5`).
*   **排版**: 宽松的行高，无衬线字体 (Inter/System UI).
*   **交互**: 
    *   侧边栏导航 (收起/展开).
    *   卡片式布局 (Card).
    *   胶囊标签 (Badge) 展示元数据.
    *   Markdown 渲染支持代码高亮和表格.
