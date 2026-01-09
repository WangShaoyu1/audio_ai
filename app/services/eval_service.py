import pandas as pd
import io
import asyncio
import logging
import time
import uuid
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.dialogue_manager import DialogueManager
from app.core.config import settings

logger = logging.getLogger(__name__)

class EvalService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.dm = DialogueManager()

    async def run_batch_test(self, file_content: bytes, user_id: uuid.UUID) -> bytes:
        """
        Process Excel file, run tests, and return result Excel file as bytes.
        """
        try:
            # 1. Read Excel
            df = pd.read_excel(io.BytesIO(file_content))
            
            # Validate columns
            required_cols = ['case_id', 'query', 'expected_intent', 'expected_keywords']
            if not all(col in df.columns for col in required_cols):
                raise ValueError(f"Missing required columns: {required_cols}")

            results = []
            
            # 2. Run tests concurrently (with semaphore to limit concurrency)
            sem = asyncio.Semaphore(5) # Limit to 5 concurrent requests
            
            tasks = []
            for _, row in df.iterrows():
                tasks.append(self._process_single_case(row, sem, user_id))
            
            results = await asyncio.gather(*tasks)
            
            # 3. Create Result DataFrame
            result_df = pd.DataFrame(results)
            
            # 4. Export to Excel
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                result_df.to_excel(writer, index=False)
            
            return output.getvalue()

        except Exception as e:
            logger.error(f"Batch test failed: {e}")
            raise

    async def _process_single_case(self, row, sem, user_id: uuid.UUID):
        async with sem:
            case_id = row['case_id']
            query = row['query']
            expected_intent = str(row['expected_intent']).strip().lower()
            expected_keywords = str(row['expected_keywords']).split(',') if pd.notna(row['expected_keywords']) else []
            
            # Use a temporary session ID for eval
            session_id = f"eval_{user_id}_{case_id}"
            
            start_time = time.time()
            
            try:
                # Call DialogueManager with real user_id
                response = await self.dm.process_request(session_id, query, str(user_id), self.db)
                
                end_time = time.time()
                total_ms = int((end_time - start_time) * 1000)
                
                actual_intent = response['metadata']['route']
                actual_response = response['content']
                metadata = response['metadata']
                
                # Determine Pass/Fail
                intent_match = expected_intent in actual_intent.lower()
                keyword_match = True
                if expected_keywords:
                    keyword_match = any(k.strip().lower() in actual_response.lower() for k in expected_keywords)
                
                status = "PASS" if intent_match and keyword_match else "FAIL"
                
                models = metadata.get('models_used', {})
                model_name = models.get('executor', 'unknown')
                provider = settings.DEFAULT_LLM_PROVIDER 
                
                return {
                    "case_id": case_id,
                    "query": query,
                    "expected_intent": expected_intent,
                    "expected_keywords": ",".join(expected_keywords),
                    "actual_intent": actual_intent,
                    "actual_response": actual_response,
                    "provider": provider,
                    "model_name": model_name,
                    "ttft_ms": metadata['latency'].get('ttft_ms', 0),
                    "total_latency_ms": total_ms,
                    "status": status
                }
                
            except Exception as e:
                logger.error(f"Case {case_id} failed: {e}")
                return {
                    "case_id": case_id,
                    "query": query,
                    "status": "ERROR",
                    "actual_response": str(e)
                }
