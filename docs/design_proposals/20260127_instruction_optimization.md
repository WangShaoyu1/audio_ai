# 需求分析与技术设计：指令库管理与响应优化

## 1. 需求分析 (Requirements Analysis)

### 1.1. 多指令库支持 (Multiple Instruction Repositories)
**背景**:
当前系统所有指令混在一个池子中，无法区分不同设备（如车载、家居）和不同语言（中文、英文）。
**需求**:
1.  **指令库管理**: 新增“指令库”概念，支持按设备类型、语言进行分类管理。
2.  **会话关联**: 每个会话 (Session) 必须配置一个具体的指令库。
3.  **强制校验**: 若会话未配置指令库，前后端需进行拦截或提示，禁止开始对话。

### 1.2. 指令响应优化与反馈 (Instruction Optimization & Feedback)
**背景**:
指令解析依赖 LLM，耗时较长（2s-4s）。针对高频重复指令，可以通过缓存机制实现毫秒级响应。
**需求**:
1.  **人工打标 (Feedback)**:
    *   **单条反馈**: 支持对单条指令回复进行“点赞/认可”或“点踩”。
    *   **批量反馈**: 支持在会话历史中批量选中指令类消息进行“认可”。
2.  **Redis 缓存**:
    *   **写入**: 当用户“认可”某条指令回复时，将 `(Query) -> (Instruction JSON)` 关系写入 Redis。
    *   **读取**: 对话流程中，优先查询 Redis。若命中缓存，直接返回结果，跳过 LLM 推理。
    *   **去重**: 写入时需以“提问内容”为维度进行去重。

---

## 2. 技术方案设计 (Technical Design)

### 2.1. 数据库设计 (Database Schema)

#### 2.1.1. 新增 `instruction_repositories` 表
用于管理指令库元数据。

```sql
CREATE TABLE instruction_repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,          -- 库名称 (e.g., "小米音箱-中文")
    device_type VARCHAR(50) NOT NULL,    -- 设备类型 (e.g., "smart_speaker", "car")
    language VARCHAR(10) DEFAULT 'zh',   -- 语言 (zh, en)
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2.1.2. 修改 `instructions` 表
建立指令与指令库的一对多关系。

```sql
ALTER TABLE instructions ADD COLUMN repository_id UUID REFERENCES instruction_repositories(id);
CREATE INDEX idx_instructions_repo_id ON instructions(repository_id);
```

#### 2.1.3. 修改 `sessions` 表 (或 SessionConfig JSON)
会话配置中增加 `instruction_repo_id` 字段。

---

### 2.2. API 接口设计 (API Design)

#### 2.2.1. 指令库管理 (Repository Management)
*   `GET /instruction-repos`: 获取用户的所有指令库列表。
*   `POST /instruction-repos`: 创建新指令库。
*   `PUT /instruction-repos/{id}`: 更新指令库信息。
*   `DELETE /instruction-repos/{id}`: 删除指令库 (级联删除或拒绝)。

#### 2.2.2. 指令管理 (Instruction Management)
*   `GET /instructions?repo_id={id}`: 获取指定库下的指令。
*   `POST /instructions`: 创建指令时必传 `repository_id`。

#### 2.2.3. 反馈与缓存 (Feedback & Cache)
*   `POST /chat/{message_id}/feedback`:
    *   Request: `{ "action": "like" | "dislike" }`
    *   Logic:
        *   `like`: 查询 Message 详情 -> 提取 Query 和 Response -> 写入 Redis。
        *   `dislike`: 计算 Redis Key -> 删除缓存。
*   `POST /sessions/{session_id}/feedback/batch`:
    *   Request: `{ "message_ids": ["uuid1", "uuid2"] }`
    *   Logic: 批量执行 `like` 逻辑。

---

### 2.3. 核心业务流程 (Core Logic)

#### 2.3.1. Redis 缓存策略 (Caching Strategy)
*   **Key 格式**: `instr:cache:{repo_id}:{md5(query)}`
    *   使用 `repo_id` 隔离不同设备的指令（例如“打开空调”在车载和家居中可能对应的 JSON 不同）。
    *   使用 `md5(query)` 压缩 Key 长度。
*   **Value**: 指令解析后的标准 JSON 字符串。
*   **TTL**: 建议设置为 `None` (永久) 或较长时间 (e.g., 30天)，由用户反馈行为手动管理生命周期。

#### 2.3.2. 对话引擎改造 (Dialogue Engine Update)
在 `DialogueManager` 的处理流程中插入缓存层：

1.  **前置校验**: 检查 Session Config 是否包含 `instruction_repo_id`。若无，直接抛出错误。
2.  **缓存查询 (Cache Hit)**:
    *   根据 `(repo_id, query)` 计算 Redis Key。
    *   `GET Key`。
    *   若存在 -> **直接返回** (Intent="instruction", Content=Cached JSON, Latency=Redis RTT)。
3.  **常规流程 (Cache Miss)**:
    *   执行意图识别 (Router)。
    *   若 Intent="instruction":
        *   加载 `repo_id` 对应的所有指令 Schema。
        *   调用 LLM 生成 JSON。
    *   返回结果 (此时**不自动写入** Redis，需等待用户点赞)。

---

### 2.4. 前端改造 (Frontend Changes)

#### 2.4.1. 会话配置 (Session Config)
*   新增 "Instruction Repository" 下拉选择框。
*   数据源：调用 `GET /instruction-repos`。
*   校验：若未选择，"New Chat" 或 "Save Config" 按钮置灰或弹窗提示。

#### 2.4.2. 聊天窗口 (Chat Interface)
*   **单条反馈**: 在每条 AI 回复（且 Intent=Instruction）下方增加 👍 / 👎 按钮。
    *   点击 👍: 调用 Feedback API (like)，图标变实心。
    *   点击 👎: 调用 Feedback API (dislike)，图标变实心。
*   **批量模式**: 在会话菜单中增加 "Batch Optimize" (批量优化) 选项。
    *   进入多选模式，筛选出所有 Instruction 类型的消息。
    *   用户勾选 -> 点击 "Confirm" -> 调用 Batch API。

---

## 3. 下一步计划 (Action Plan)

1.  **Phase 1: 基础架构 (Backend)**
    *   创建 `InstructionRepository` 模型并迁移数据库。
    *   更新 `InstructionService` 支持 Repo 维度查询。
    *   实现 Redis 管理类 `InstructionCacheManager`。
2.  **Phase 2: 接口与逻辑 (API & Logic)**
    *   实现 Repo CRUD 接口。
    *   实现 Feedback 接口 (写入 Redis)。
    *   修改 `DialogueManager` 接入缓存读取逻辑。
3.  **Phase 3: 前端适配 (Frontend)**
    *   开发指令库管理页面 (可复用现有的 Instruction 管理页，增加左侧目录树或顶部筛选)。
    *   更新会话配置弹窗。
    *   实现聊天气泡的点赞交互。
