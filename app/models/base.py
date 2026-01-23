from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, DateTime, Text, Integer, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from pgvector.sqlalchemy import Vector
import uuid
from datetime import datetime

# Define common types for PostgreSQL
UUID_TYPE = PG_UUID(as_uuid=True)
JSON_TYPE = JSONB
VECTOR_TYPE = Vector() # Flexible dimension

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    phone = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

class Session(Base):
    __tablename__ = "sessions"
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    name = Column(String, default="New Chat")
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    context = Column(JSON_TYPE, default={})

class Message(Base):
    __tablename__ = "messages"
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID_TYPE, ForeignKey("sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    metadata_ = Column(JSON_TYPE, default={})
    embedding = Column(VECTOR_TYPE)
    created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    filename = Column(String, nullable=False)
    size = Column(String, nullable=True)
    status = Column(String, default="uploaded")
    error_msg = Column(Text, nullable=True)
    content = Column(Text, nullable=True) # Store raw content for delayed indexing
    file_path = Column(String, nullable=True) # Path to stored original file
    provider = Column(String, nullable=True) # Embedding provider used
    model = Column(String, nullable=True) # Embedding model used
    is_configured = Column(Boolean, default=False) # Whether RAG config has been confirmed for this doc
    created_at = Column(DateTime, default=datetime.utcnow)

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    doc_id = Column(UUID_TYPE, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    embedding = Column(VECTOR_TYPE)

class RAGTestRecord(Base):
    __tablename__ = "rag_test_records"
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    doc_id = Column(UUID_TYPE, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True)
    query = Column(Text, nullable=False)
    results = Column(JSON_TYPE, default=[]) # Store list of retrieved chunks
    created_at = Column(DateTime, default=datetime.utcnow)
