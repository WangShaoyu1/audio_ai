from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base
import uuid

class Instruction(Base):
    __tablename__ = "instructions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False) # Added user_id
    name = Column(String, nullable=False, index=True) # Removed unique constraint globally, should be unique per user
    description = Column(Text, nullable=False)
    parameters = Column(JSONB, nullable=False, default={}) # JSON Schema
    mutex_config = Column(JSONB, default={"incompatible": []})
    is_active = Column(Boolean, default=True)
