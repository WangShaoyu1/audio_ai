# AI语音语义理解方案：部署架构详解与迁移指南

本文档基于《AI语音语义理解方案设计文档》，对腾讯云线上部署架构和Windows本地调试架构进行深度细化，并提供从本地环境向云端环境迁移的详细操作指南。

## 1. 腾讯云线上部署架构（生产环境）

生产环境采用云原生架构，利用腾讯云PaaS服务实现高可用、弹性伸缩和免运维。

### 1.1. 架构拓扑图

```mermaid
graph TD
    User[用户/智能微波炉] -->|HTTPS/WSS| CLB[负载均衡 CLB]
    CLB -->|流量分发| Ingress[K8s Ingress Controller]
    
    subgraph "VPC 私有网络 (10.0.0.0/16)"
        subgraph "TKE 容器集群 (10.0.1.0/24)"
            Ingress -->|路由| API_Gateway[API 网关服务]
            
            subgraph "应用服务层"
                API_Gateway --> DM[对话管理服务 (DM)]
                DM -->|gRPC| Intent[意图识别服务]
                DM -->|gRPC| RAG[RAG 检索服务]
                DM -->|gRPC| Chat[通用对话服务]
                
                Intent -->|Function Call| LLM_Adapter[大模型适配层]
                RAG -->|Context| LLM_Adapter
                Chat -->|Prompt| LLM_Adapter
            end
            
            subgraph "运维监控 Sidecar"
                LogAgent[CLS 日志采集]
                MetricAgent[云监控组件]
            end
        end
        
        subgraph "数据存储层 (PaaS)"
            Redis[云数据库 Redis]
            PG[TDSQL-C PostgreSQL (pgvector)]
            COS[对象存储 COS]
        end
    end
    
    subgraph "外部服务"
        LLM_API[大模型厂商 API]
        Search_API[在线搜索 API]
    end
    
    %% 连接关系
    DM -->|读写会话状态| Redis
    RAG -->|向量检索| PG
    DM -->|读写记忆| PG
    RAG -->|读取原始文档| COS
    
    LLM_Adapter -->|API 调用| LLM_API
    Chat -->|API 调用| Search_API
    
    %% 样式定义
    style TKE fill:#e1f5fe,stroke:#01579b
    style Redis fill:#fff3e0,stroke:#e65100
    style PG fill:#e8f5e9,stroke:#1b5e20
    style COS fill:#f3e5f5,stroke:#4a148c
```

### 1.2. 关键组件配置详情

| 组件 | 腾讯云产品 | 推荐配置 | 关键参数设置 |
| :--- | :--- | :--- | :--- |
| **负载均衡** | CLB | 公网型，按流量计费 | 开启HTTPS监听，配置SSL证书；开启Gzip压缩。 |
| **容器集群** | TKE | 标准托管集群 | Kubernetes版本建议 1.28+；开启VPC-CNI网络模式以提升网络性能。 |
| **计算节点** | CVM | 标准型S5 (4核8G) | 初始节点数：3；配置弹性伸缩组(ASG)，CPU利用率>70%自动扩容。 |
| **数据库** | TDSQL-C PG版 | Serverless (2核4G起) | 内核版本：PostgreSQL 15+；**必须安装插件**：`vector` (pgvector), `zhparser` (中文分词)。 |
| **缓存** | Redis | 标准架构 (4GB) | 版本：6.2+；配置持久化策略为AOF（每秒刷盘）。 |
| **对象存储** | COS | 标准存储 | 开启CDN加速（可选，用于文档预览）；配置生命周期规则（如临时文件7天自动清理）。 |

---

## 2. Windows本地调试架构（开发环境）

开发环境侧重于快速启动和便捷调试，利用Docker Compose一键拉起依赖服务。

### 2.1. 架构拓扑图

```mermaid
graph TD
    Dev[开发者/Postman] -->|HTTP| LocalAPI[本地 Python API (FastAPI)]
    
    subgraph "Docker Desktop (WSL2)"
        subgraph "Docker Compose Network"
            LocalRedis[Redis 容器]
            LocalPG[PostgreSQL + pgvector 容器]
            LocalMilvus[Milvus Standalone (可选)]
        end
    end
    
    subgraph "本地文件系统"
        Config[config.yaml]
        Env[.env]
        Docs[./data/docs]
    end
    
    LocalAPI -->|localhost:6379| LocalRedis
    LocalAPI -->|localhost:5432| LocalPG
    LocalAPI -->|读取| Config
    LocalAPI -->|读取| Env
    LocalAPI -->|读取| Docs
    
    LocalAPI -->|公网请求| LLM_API[大模型 API]
```

### 2.2. `docker-compose-dev.yml` 配置示例

```yaml
version: '3.8'

services:
  # 1. Redis 服务
  redis:
    image: redis:7-alpine
    container_name: ai_voice_redis
    ports:
      - "6379:6379"
    volumes:
      - ./redis_data:/data
    command: redis-server --appendonly yes

  # 2. PostgreSQL 服务 (带 pgvector)
  postgres:
    image: pgvector/pgvector:pg16
    container_name: ai_voice_pg
    environment:
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: ai_voice_db
    ports:
      - "5432:5432"
    volumes:
      - ./pg_data:/var/lib/postgresql/data
    # 初始化脚本：自动启用 vector 插件
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev_user -d ai_voice_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # 3. 管理界面 (可选，用于查看数据库)
  pgadmin:
    image: dpage/pgadmin4
    container_name: ai_voice_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "8080:80"
    depends_on:
      - postgres
```

---

## 3. 环境迁移指南：从本地到腾讯云

从Windows本地环境迁移到腾讯云生产环境时，需重点关注以下差异点和操作步骤。

### 3.1. 关键差异点对照表

| 关注点 | 本地环境 (Windows/Docker) | 生产环境 (腾讯云 TKE/PaaS) | 迁移注意事项 |
| :--- | :--- | :--- | :--- |
| **文件路径** | 使用反斜杠 `\` 或 Windows 路径 | 使用正斜杠 `/`，Linux 路径 | 代码中必须使用 `os.path.join` 或 `pathlib` 处理路径；避免硬编码绝对路径。 |
| **数据库连接** | `localhost` 或 `127.0.0.1` | 云数据库内网 IP 或域名 | 生产环境配置应通过环境变量注入，严禁写死在代码中。 |
| **文件存储** | 本地磁盘目录 | 对象存储 (COS) | 代码需抽象文件存储接口（Storage Interface），本地实现为File System，线上实现为COS SDK。 |
| **日志输出** | 控制台 (Console) / 本地文件 | 标准输出 (Stdout) -> CLS | 生产环境应用应将日志打印到Stdout，由K8s日志采集器收集，不要写死到容器内文件。 |
| **HTTPS/SSL** | 通常使用 HTTP | 强制 HTTPS | 生产环境需在CLB或Ingress层配置SSL证书，应用层需处理 `X-Forwarded-Proto` 头。 |

### 3.2. 迁移操作清单

1.  **配置分离**：
    *   确保所有敏感配置（API Key, DB密码）和环境相关配置（Host, Port）都已提取到环境变量或配置文件中。
    *   创建 `config.prod.yaml` 或使用 K8s ConfigMap/Secret 管理生产配置。

2.  **数据库迁移**：
    *   **Schema 导出**：使用 `pg_dump -s` 导出本地数据库结构（含 `CREATE EXTENSION vector` 语句）。
    *   **数据同步**：如果需要同步本地测试数据（如基础指令集），使用 `pg_dump -a` 导出数据。
    *   **云端导入**：通过 `psql` 客户端连接腾讯云 TDSQL-C 实例，执行导入脚本。**注意**：需先在云端实例上手动执行 `CREATE EXTENSION vector;` 确保插件已启用。

3.  **容器镜像构建**：
    *   编写 `Dockerfile`，基于 `python:3.10-slim` 等轻量级基础镜像。
    *   在构建过程中，注意安装系统级依赖（如 `libpq-dev` 用于pg驱动，`ffmpeg` 用于音频处理）。
    *   使用腾讯云 TCR (容器镜像仓库) 存储构建好的镜像。

4.  **K8s 部署清单编写**：
    *   编写 `deployment.yaml`：定义副本数、资源限制 (Requests/Limits)、环境变量。
    *   编写 `service.yaml`：定义集群内服务发现。
    *   编写 `ingress.yaml`：定义对外访问规则。

5.  **连通性测试**：
    *   部署后，先在Pod内部测试与 Redis、TDSQL-C、COS 的连通性（使用 `telnet` 或 `nc`）。
    *   验证大模型API在云端环境是否可访问（注意公网出口IP白名单配置）。
