from sqlalchemy import Column, String, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base
import uuid

class Instruction(Base):
    __tablename__ = "instructions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    parameters = Column(JSONB, nullable=False, default={}) # JSON Schema
    mutex_config = Column(JSONB, default={"incompatible": []})
    is_active = Column(Boolean, default=True)
