import pandas as pd
import io
import json
import logging
from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
# Assuming we have an Instruction model and service
# from app.models.instruction import Instruction
# from app.services.instruction_service import InstructionService

logger = logging.getLogger(__name__)

class InstructionImportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def import_from_excel(self, file_content: bytes) -> Dict[str, int]:
        """
        Import instructions from Excel file.
        Returns stats: {'total': 10, 'success': 9, 'failed': 1}
        """
        try:
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
                    
                    # Validate JSON
                    try:
                        parameters = json.loads(params_str)
                    except json.JSONDecodeError:
                        raise ValueError(f"Invalid JSON in parameters_json for {name}")
                    
                    response_template = row.get('response_template', '')
                    
                    # TODO: Save to DB
                    # await self.instruction_service.create_instruction(...)
                    logger.info(f"Importing instruction: {name}")
                    
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
