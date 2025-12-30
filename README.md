# AI Voice Solution (Audio AI)

基于大模型技术的智能语音语义理解系统，专为智能微波炉等硬件设备设计。

## 核心特性

*   **多模型支持**：无缝集成 Azure OpenAI, Qwen (通义千问), Minimax, Deepseek, OpenAI, Zhipu AI (智谱), Baidu Qianfan (文心一言), Google Gemini, Xunfei Spark (讯飞星火)。
*   **智能路由**：基于 LLM 的意图分类，动态路由至指令控制、RAG 问答或通用对话。
*   **RAG 引擎**：基于 PostgreSQL (pgvector) 的向量检索，支持文档上传与自动索引。
*   **指令引擎**：支持复合指令解析与互斥逻辑检查。
*   **记忆系统**：Redis 短期记忆 + PostgreSQL 中长期记忆（用户画像）。

## 快速开始

### 1. 环境准备

*   Python 3.10+
*   PostgreSQL 15+ (需安装 `vector` 插件)
*   Redis 6+

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填入相应的 API Key。

```bash
cp .env.example .env
```

**多模型配置示例 (.env):**

```ini
# 默认模型提供商
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_MODEL=gpt-3.5-turbo

# 场景化覆盖 (可选)
# 指令控制使用 Azure (高稳定性)
INSTRUCTION_LLM_PROVIDER=azure
INSTRUCTION_LLM_MODEL=gpt-4
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_API_BASE=your_endpoint
AZURE_DEPLOYMENT_NAME=your_deployment

# RAG 使用 Qwen (长文本优势)
RAG_LLM_PROVIDER=qwen
RAG_LLM_MODEL=qwen-turbo
QWEN_API_KEY=your_key

# 闲聊使用 Deepseek (高性价比)
CHAT_LLM_PROVIDER=deepseek
CHAT_LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=your_key
```

### 4. 启动服务

使用 Docker Compose 一键启动（包含 DB 和 Redis）：

```bash
docker-compose up -d
```

或者本地启动应用：

```bash
uvicorn app.main:app --reload
```

## API 文档

启动后访问 `http://localhost:8000/docs` 查看完整的 Swagger 文档。

*   `POST /api/v1/chat/completions`: 核心对话接口
*   `POST /api/v1/admin/instructions`: 指令管理
*   `POST /api/v1/admin/documents/upload`: 文档上传

## 部署架构

详见 `Deployment_Architecture_Detail.md`。
