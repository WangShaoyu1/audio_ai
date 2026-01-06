# System Architecture Diagrams

## 1. System Flowchart (系统流程图)

This flowchart illustrates the high-level data flow from the user's voice input to the final audio response.

```mermaid
graph TD
    User([User]) -->|Voice Input| Frontend["Frontend (Web/App)"]
    Frontend -->|Audio Stream| STT["Speech-to-Text Service"]
    STT -->|Text| API["Backend API (FastAPI)"]
    
    subgraph "Backend Core"
        API -->|Request| DM["Dialogue Manager"]
        DM -->|Query| Memory["Memory Manager"]
        Memory <-->|Read/Write| Redis[("Redis Cache")]
        Memory <-->|Read/Write| PG[("PostgreSQL DB")]
        
        DM -->|Query| RAG["RAG Engine"]
        RAG <-->|Vector Search| PG
        
        DM -->|Prompt| LLM["LLM Factory"]
        LLM -->|API Call| ModelProvider["Model Provider (OpenAI/Qwen/etc.)"]
        ModelProvider -->|Response| LLM
    end
    
    LLM -->|Text Response| DM
    DM -->|Final Response| API
    API -->|Text| TTS["Text-to-Speech Service"]
    TTS -->|Audio| Frontend
    Frontend -->|Playback| User
```

## 2. Sequence Diagram (时序图)

This sequence diagram details the interaction between system components during a typical conversation turn.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as Backend API
    participant DM as Dialogue Manager
    participant Memory as Memory Manager (Redis/PG)
    participant RAG as RAG Engine
    participant LLM as LLM Factory
    participant Provider as Model Provider

    User->>Frontend: Speak (Voice Input)
    Frontend->>API: Send Audio/Text
    API->>DM: Process Request (session_id, text)
    
    par Parallel Context Retrieval
        DM->>Memory: Get Short-term History
        Memory-->>DM: Return History List
    and
        DM->>RAG: Retrieve Relevant Docs
        RAG->>RAG: Vector Search (PG)
        RAG-->>DM: Return Context Chunks
    end
    
    DM->>DM: Construct Prompt (System + Context + History + Query)
    DM->>LLM: Create LLM Instance (Provider Config)
    LLM->>Provider: Chat Completion Request
    Provider-->>LLM: Stream/Return Response
    LLM-->>DM: Text Response
    
    par Async Save
        DM->>Memory: Save Turn (User + AI)
        Memory->>Memory: Write to Redis & PG
    end
    
    DM-->>API: Final Response Object
    API-->>Frontend: Return Text & Audio URL
    Frontend->>User: Play Audio & Show Text
```
