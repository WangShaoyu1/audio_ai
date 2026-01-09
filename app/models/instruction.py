from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from app.models.base import Base, UUID_TYPE, JSON_TYPE
import uuid

class Instruction(Base):
    __tablename__ = "instructions"
    
    id = Column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID_TYPE, ForeignKey("users.id"), nullable=False) # Added user_id
    name = Column(String, nullable=False, index=True) # Removed unique constraint globally, should be unique per user
    description = Column(Text, nullable=False)
    parameters = Column(JSON_TYPE, nullable=False, default={}) # JSON Schema
    mutex_config = Column(JSON_TYPE, default={"incompatible": []})
    is_active = Column(Boolean, default=True)
