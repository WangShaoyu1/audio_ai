from sqlalchemy import Column, String, Boolean, Text, ForeignKey, DateTime, Integer
from app.models.base import Base, UUID_TYPE, JSON_TYPE
import uuid
from datetime import datetime

class InstructionRepository(Base):
    __tablename__ = "instruction_repositories"
    
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    device_type = Column(String, nullable=False) # e.g., 'smart_speaker', 'car'
    language = Column(String, default='zh') # 'zh', 'en'
    description = Column(Text, nullable=True)
    active_system_version = Column(Integer, nullable=True) # Active version of system pairs
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Instruction(Base):
    __tablename__ = "instructions"
    
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=True) # Nullable for system defaults
    repository_id = Column(UUID_TYPE, ForeignKey("instruction_repositories.id"), nullable=True) # New column
    name = Column(String, nullable=False, index=True) 
    description = Column(Text, nullable=False)
    parameters = Column(JSON_TYPE, nullable=False, default={}) # JSON Schema
    mutex_config = Column(JSON_TYPE, default={"incompatible": []})
    is_active = Column(Boolean, default=True)
