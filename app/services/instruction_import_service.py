import pandas as pd
import io
import json
import logging
import uuid
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.instruction_service import InstructionService

logger = logging.getLogger(__name__)

class InstructionImportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.instruction_service = InstructionService(db)

    async def import_from_excel(self, file_content: bytes, user_id: uuid.UUID, repository_id: uuid.UUID, filename: str = "import.xlsx") -> Dict[str, Any]:
        """
        Import instructions from Excel or CSV file.
        """
        try:
            if filename.lower().endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file_content))
            else:
                df = pd.read_excel(io.BytesIO(file_content))
            
            required_cols = ['name', 'description', 'parameters_json']
            if not all(col in df.columns for col in required_cols):
                raise ValueError(f"Missing required columns: {required_cols}")
            
            success_count = 0
            failed_count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    name = row['name']
                    description = row['description']
                    params_str = row['parameters_json']
                    
                    try:
                        parameters = json.loads(params_str)
                    except json.JSONDecodeError:
                        raise ValueError(f"Invalid JSON in parameters_json for {name}")
                    
                    mutex_config = {}
                    if 'mutex_config_json' in row:
                        try:
                            mutex_config = json.loads(row['mutex_config_json'])
                        except:
                            pass

                    data = {
                        "repository_id": repository_id,
                        "name": name,
                        "description": description,
                        "parameters": parameters,
                        "mutex_config": mutex_config,
                        "is_active": True
                    }
                    
                    await self.instruction_service.create_instruction(data, user_id=user_id)
                    success_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    errors.append(f"Row {index+2}: {str(e)}")
            
            return {
                "total": len(df),
                "success": success_count,
                "failed": failed_count,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"Instruction import failed: {e}")
            raise
