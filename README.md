# AI Voice Assistant Backend

## Overview
This is the backend service for the AI Voice Assistant, providing semantic understanding, instruction execution, and RAG-based QA capabilities.

## Tech Stack
- **Framework**: FastAPI
- **Database**: PostgreSQL + pgvector
- **Cache**: Redis
- **LLM Orchestration**: LangChain
- **LLM Provider**: OpenAI (Configurable)

## Setup

### Prerequisites
- Docker & Docker Compose
- OpenAI API Key

### Running Locally
1. Create a `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env and set OPENAI_API_KEY
   ```

2. Start services:
   ```bash
   docker-compose up -d
   ```

3. Access API docs at `http://localhost:8000/docs`

## Project Structure
```
app/
  api/          # API endpoints
  core/         # Config & security
  db/           # Database connection
  models/       # SQLAlchemy models
  services/     # Business logic (DM, RAG, Memory)
tests/          # Pytest suite
```
