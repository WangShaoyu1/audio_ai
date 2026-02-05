from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc, and_, or_
from app.models.base import Message, Session, BenchmarkCase
from app.core.redis import RedisClient
from app.core.logger import logger
import hashlib
import json
import uuid
from typing import List, Optional
from datetime import datetime, timezone
import pytz

class FeedbackService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.redis = RedisClient.get_instance()

    def _get_cache_key(self, query: str, repository_id: Optional[uuid.UUID] = None) -> str:
        # Normalize query
        normalized_query = query.strip().lower()
        # Create hash
        query_hash = hashlib.sha256(normalized_query.encode('utf-8')).hexdigest()
        
        if repository_id:
            return f"instruction_cache:{repository_id}:{query_hash}"
        return f"instruction_cache:{query_hash}"

    async def get_cached_instruction_response(self, query: str, repository_id: Optional[uuid.UUID] = None) -> Optional[str]:
        """
        Retrieve cached instruction response for a given query.
        """
        key = self._get_cache_key(query, repository_id)
        try:
            cached_data = await self.redis.get(key)
            if cached_data:
                data = json.loads(cached_data)
                logger.info(f"Instruction cache hit for query: {query} (repo: {repository_id})")
                return data.get("response")
        except Exception as e:
            logger.error(f"Redis get error: {e}")
        return None

    async def cache_instruction_response(self, query: str, response: str, repository_id: Optional[uuid.UUID] = None):
        """
        Cache instruction response.
        """
        key = self._get_cache_key(query, repository_id)
        
        try:
            # Deduplication: Check if key exists
            if await self.redis.exists(key):
                logger.info(f"Instruction cache already exists for query: {query} (repo: {repository_id}). Skipping cache update.")
                return

            data = {
                "response": response,
                "original_query": query,
                "repository_id": str(repository_id) if repository_id else None
            }
            
            # Use REDIS_ENABLE_EVICTION to control TTL
            from app.core.config import settings
            ttl = None
            if settings.REDIS_ENABLE_EVICTION:
                ttl = 60 * 60 * 24 * 7 # 7 days example default
                
            await self.redis.set(key, json.dumps(data, ensure_ascii=False), ex=ttl)
            logger.info(f"Cached instruction response for query: {query} (repo: {repository_id})")
        except Exception as e:
            logger.error(f"Redis set error: {e}")

    async def increment_hit_count(self, query: str):
        """
        Increment hit count for a query.
        """
        key = self._get_cache_key(query)
        # We use a separate key for hit counts to avoid overwriting cache data structure
        # Key: instruction_stats:hit_count:{query_hash}
        query_hash = key.split(":")[-1] # Extract hash
        stats_key = f"instruction_stats:hit_count:{query_hash}"
        
        try:
            await self.redis.incr(stats_key)
        except Exception as e:
            logger.error(f"Redis incr error: {e}")

    async def submit_feedback(self, message_id: uuid.UUID, feedback: str):
        """
        Submit feedback for a message. If 'like' and it's an instruction response, cache it.
        If 'delete', remove the benchmark case or mark message as deleted.
        """
        # Try to find in BenchmarkCase first (System Pairs)
        stmt_bench = select(BenchmarkCase).where(BenchmarkCase.id == message_id)
        res_bench = await self.db.execute(stmt_bench)
        case = res_bench.scalar_one_or_none()
        
        if case:
            if feedback == "delete":
                await self.db.delete(case)
                await self.db.commit()
                # Remove from Redis cache if exists
                key = self._get_cache_key(case.question, case.repository_id)
                await self.redis.delete(key)
                return
            
            # If it's a benchmark case, we just check if feedback is like to cache it
            if feedback == "like":
                await self.cache_instruction_response(case.question, case.answer, repository_id=case.repository_id)
            return

        # Try Message
        stmt = select(Message).where(Message.id == message_id)
        result = await self.db.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise ValueError(f"Message {message_id} not found")

        if feedback == "delete":
            # For user messages, we might not want to physically delete to preserve history,
            # or we do if it's just a cleanup. 
            # Given "Accumulate Corpus" goal, deleting 'bad' data is fine.
            # But deleting a message might break 'reply_to' chains.
            # Let's set content to [Deleted] or just mark feedback as 'deleted'.
            message.feedback = 'deleted'
            await self.db.commit()
            return

        # Update DB
        message.feedback = feedback
        await self.db.commit()
        
        # If feedback is 'like' and it's an instruction response, cache it
        try:
            if feedback == "like" and message.role == "assistant":
                # Check metadata to see if it was an instruction intent
                meta = message.metadata_ or {}
                
                # Check if route is instruction
                if meta.get("route") == "instruction":
                    # We need the original query.
                    # metadata["reply_to"] has the user message ID
                    reply_to_id = meta.get("reply_to")
                    if reply_to_id:
                        # Fetch user message
                        stmt_user = select(Message).where(Message.id == reply_to_id)
                        res_user = await self.db.execute(stmt_user)
                        user_msg = res_user.scalar_one_or_none()
                        
                        # Get Repository ID from Session
                        repo_id = None
                        try:
                            stmt_session = select(Session).where(Session.id == message.session_id)
                            res_session = await self.db.execute(stmt_session)
                            session_obj = res_session.scalar_one_or_none()
                            if session_obj and session_obj.context:
                                repo_id_str = session_obj.context.get("llm_config", {}).get("INSTRUCTION_REPO_ID")
                                if repo_id_str:
                                    repo_id = uuid.UUID(repo_id_str)
                        except Exception as e:
                            logger.warning(f"Failed to get repository ID from session: {e}")
                        
                        if user_msg:
                            await self.cache_instruction_response(user_msg.content, message.content, repository_id=repo_id)
                        else:
                            logger.warning(f"Could not find original user message {reply_to_id} for instruction caching")
                    else:
                        logger.warning(f"Message {message_id} has no reply_to in metadata, cannot cache")
        except Exception as e:
            logger.error(f"Error during feedback caching: {e}")
            # Do not re-raise, as the feedback itself was successful

    async def batch_submit_feedback(self, message_ids: List[uuid.UUID], feedback: str):
        """
        Batch submit feedback for multiple messages.
        """
        for msg_id in message_ids:
            try:
                await self.submit_feedback(msg_id, feedback)
            except Exception as e:
                logger.error(f"Error processing feedback for message {msg_id}: {e}")

    async def get_instruction_pairs(
        self, 
        start_date: Optional[datetime] = None, 
        end_date: Optional[datetime] = None, 
        marked: Optional[bool] = None, 
        order: str = "desc",
        session_query: Optional[str] = None,
        session_ids: Optional[List[uuid.UUID]] = None,
        source: str = "user",
        repository_id: Optional[uuid.UUID] = None,
        version: Optional[int] = None,
        unmatched: Optional[bool] = None,
        sort_by: Optional[str] = None, # 'hit_count_asc', 'hit_count_desc'
        hit_source: Optional[str] = None # 'llm', 'redis', 'memory'
    ):
        """
        Get instruction question-answer pairs across all sessions.
        """
        if source == "system":
            # System pairs typically don't have hit_source. 
            # If a specific hit_source is requested (other than 'all' implicit), 
            # we might return empty or just ignore. 
            # But the user might want to see System pairs regardless?
            # User requirement: "llm redis memory all". 
            # If "llm" is selected, System pairs (which are Benchmarks) are NOT LLM hits in the runtime sense.
            # So if hit_source is provided, we probably skip System pairs unless there's a match logic?
            # For now, let's assume System pairs are excluded if hit_source is set to 'redis' or 'memory' or 'llm'.
            if hit_source:
                 return []
            
            stmt = select(BenchmarkCase)
            if repository_id:
                stmt = stmt.where(BenchmarkCase.repository_id == repository_id)
            if version:
                stmt = stmt.where(BenchmarkCase.version == version)
            if session_query:
                stmt = stmt.where(
                    (BenchmarkCase.question.ilike(f"%{session_query}%")) |
                    (BenchmarkCase.answer.ilike(f"%{session_query}%")) |
                    (BenchmarkCase.intent.ilike(f"%{session_query}%"))
                )
            
            if start_date:
                if start_date.tzinfo is not None:
                     start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
                stmt = stmt.where(BenchmarkCase.created_at >= start_date)
            if end_date:
                if end_date.tzinfo is not None:
                     end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)
                stmt = stmt.where(BenchmarkCase.created_at <= end_date)
                
            if order == "asc":
                stmt = stmt.order_by(asc(BenchmarkCase.created_at))
            else:
                stmt = stmt.order_by(desc(BenchmarkCase.created_at))
                
            result = await self.db.execute(stmt)
            cases = result.scalars().all()
            
            # Fetch hit counts
            pairs = []
            for case in cases:
                # Calculate hit count key
                query_hash = hashlib.sha256(case.question.strip().lower().encode('utf-8')).hexdigest()
                stats_key = f"instruction_stats:hit_count:{query_hash}"
                hit_count = 0
                try:
                    val = await self.redis.get(stats_key)
                    if val:
                        hit_count = int(val)
                except:
                    pass
                
                # Adjust timestamp (System pairs default to Asia/Shanghai)
                timestamp = case.created_at
                if timestamp:
                     if timestamp.tzinfo is None:
                         timestamp = timestamp.replace(tzinfo=timezone.utc)
                     try:
                         tz = pytz.timezone("Asia/Shanghai")
                         timestamp = timestamp.astimezone(tz)
                     except:
                         pass

                pairs.append({
                    "id": case.id,
                    "session_id": uuid.UUID('00000000-0000-0000-0000-000000000000'), 
                    "session_name": "System",
                    "question": case.question,
                    "answer": case.answer,
                    "timestamp": timestamp,
                    "feedback": None,
                    "intent": case.intent,
                    "hit_count": hit_count
                })
            
            # Sort by hit count if requested
            if sort_by == 'hit_count_asc':
                pairs.sort(key=lambda x: x['hit_count'])
            elif sort_by == 'hit_count_desc':
                pairs.sort(key=lambda x: x['hit_count'], reverse=True)
                
            return pairs

        # User History Source
        stmt = select(Message, Session)\
            .join(Session, Message.session_id == Session.id)\
            .where(Message.role == 'assistant')
        
        if unmatched:
            # Filter for unmatched instructions
            stmt = stmt.where(Message.content.ilike(f"%未找到匹配的指令%"))
        else:
             # Standard instruction pairs
             stmt = stmt.where(Message.metadata_['route'].astext == 'instruction')

        if session_ids:
             stmt = stmt.where(Session.id.in_(session_ids))

        if start_date:
            # Ensure start_date is offset-naive UTC if db is naive
            if start_date.tzinfo is not None:
                start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
            stmt = stmt.where(Message.created_at >= start_date)
        if end_date:
            if end_date.tzinfo is not None:
                end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)
            stmt = stmt.where(Message.created_at <= end_date)
            
        if marked is not None:
            if marked:
                # Exclude deleted messages from marked list
                stmt = stmt.where(and_(Message.feedback.isnot(None), Message.feedback != 'deleted'))
            else:
                # Unmarked messages (feedback is None)
                stmt = stmt.where(Message.feedback.is_(None))
        else:
            # Default: Exclude deleted messages (soft delete)
            stmt = stmt.where(or_(Message.feedback.is_(None), Message.feedback != 'deleted'))
        
        if hit_source:
            if hit_source == 'llm':
                # hit_source is null or 'llm'
                stmt = stmt.where(
                    (Message.metadata_['hit_source'].astext.is_(None)) | 
                    (Message.metadata_['hit_source'].astext == 'llm')
                )
            else:
                stmt = stmt.where(Message.metadata_['hit_source'].astext == hit_source)
                
        if order == "asc":
            stmt = stmt.order_by(asc(Message.created_at))
        else:
            stmt = stmt.order_by(desc(Message.created_at))
            
        result = await self.db.execute(stmt)
        rows = result.all()
        
        pairs = []
        for row in rows:
            msg = row[0]
            session = row[1]
            
            # Filter by repository_id if provided (manual filter since JSON query is complex)
            if repository_id:
                config = session.context.get("llm_config", {}) if session.context else {}
                repo_id_str = config.get("INSTRUCTION_REPO_ID")
                if not repo_id_str or str(repo_id_str) != str(repository_id):
                    continue

            session_name = session.name
            
            # Find the user query (reply_to)
            user_query = ""
            meta = msg.metadata_ or {}
            reply_to_id = meta.get("reply_to")
            
            if reply_to_id:
                stmt_user = select(Message).where(Message.id == reply_to_id)
                res_user = await self.db.execute(stmt_user)
                user_msg = res_user.scalar_one_or_none()
                if user_msg:
                    user_query = user_msg.content
            
            # Fetch hit count if available
            hit_count = 0
            if user_query:
                query_hash = hashlib.sha256(user_query.strip().lower().encode('utf-8')).hexdigest()
                stats_key = f"instruction_stats:hit_count:{query_hash}"
                try:
                    val = await self.redis.get(stats_key)
                    if val:
                        hit_count = int(val)
                except:
                    pass

                # Get session timezone
                tz_name = getattr(session, "timezone", "Asia/Shanghai") or "Asia/Shanghai"
                try:
                    tz = pytz.timezone(tz_name)
                except:
                    tz = pytz.timezone("Asia/Shanghai")
                
                # Adjust timestamp
                timestamp = msg.created_at
                if timestamp:
                     if timestamp.tzinfo is None:
                         timestamp = timestamp.replace(tzinfo=timezone.utc)
                     timestamp = timestamp.astimezone(tz)

                pairs.append({
                "id": msg.id,
                "user_message_id": reply_to_id, # Added user message ID
                "session_id": msg.session_id,
                "session_name": session_name,
                "question": user_query,
                "answer": msg.content,
                "timestamp": timestamp,
                "feedback": msg.feedback,
                "intent": meta.get("route", "unknown"),
                "hit_count": hit_count, 
                "hit_source": meta.get("hit_source")
            })
            
        # Sort by hit count if requested
        if sort_by == 'hit_count_asc':
            pairs.sort(key=lambda x: x['hit_count'])
        elif sort_by == 'hit_count_desc':
            pairs.sort(key=lambda x: x['hit_count'], reverse=True)

        return pairs
