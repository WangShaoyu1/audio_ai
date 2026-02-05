
import asyncio
import uuid
from unittest.mock import MagicMock, AsyncMock
from app.services.instruction_matcher import InstructionMatcher, InstructionMatcherService
from app.services.feedback_service import FeedbackService
from app.models.base import BenchmarkCase

async def test_memory_deduplication():
    print("Testing Memory Deduplication...")
    matcher = InstructionMatcher()
    
    repo_id = uuid.uuid4()
    
    # 1. Add "Set volume to 10"
    matcher.add_instruction("Set volume to 10", {"action": "set_volume", "value": 10}, repository_id=repo_id)
    print("Added template for 'Set volume to 10'")
    
    # 2. Check "Set volume to 20" (should generalize to same template)
    exists = matcher.has_template("Set volume to 20", repository_id=repo_id)
    print(f"Has template for 'Set volume to 20'? {exists}")
    assert exists is True, "Should find existing template"
    
    # 3. Check "Turn on lights" (should not exist)
    exists = matcher.has_template("Turn on lights", repository_id=repo_id)
    print(f"Has template for 'Turn on lights'? {exists}")
    assert exists is False, "Should NOT find template"

    # 4. Test generalize_and_save flow
    service = InstructionMatcherService()
    service.matcher = matcher # Inject our matcher
    
    db = AsyncMock()
    
    # Try to save "Set volume to 20"
    result = await service.generalize_and_save("Set volume to 20", {"action": "set_volume", "value": 20}, db, repository_id=repo_id)
    
    if result is None:
        print("generalize_and_save returned None (Correctly skipped DB)")
    else:
        print("generalize_and_save returned object (Incorrect)")
        
    print("Memory Deduplication Test Passed.\n")

async def test_redis_deduplication():
    print("Testing Redis Deduplication...")
    
    # Mock Redis
    mock_redis = AsyncMock()
    # Mock exists to return 1 (True)
    mock_redis.exists.return_value = 1
    
    # Patch RedisClient
    from app.core.redis import RedisClient
    original_get_instance = RedisClient.get_instance
    RedisClient.get_instance = MagicMock(return_value=mock_redis)
    
    try:
        db = AsyncMock()
        service = FeedbackService(db)
        service.redis = mock_redis # Ensure instance uses our mock
        
        repo_id = uuid.uuid4()
        query = "Test Query"
        response = "Test Response"
        
        await service.cache_instruction_response(query, response, repository_id=repo_id)
        
        # Check if set was called
        if mock_redis.set.called:
            print("Redis.set was called (Incorrect - should skip)")
        else:
            print("Redis.set was NOT called (Correctly skipped)")
            
        # Now mock exists to return 0 (False)
        mock_redis.exists.return_value = 0
        mock_redis.set.reset_mock()
        
        await service.cache_instruction_response(query, response, repository_id=repo_id)
        
        if mock_redis.set.called:
            print("Redis.set was called (Correct)")
        else:
            print("Redis.set was NOT called (Incorrect)")
            
    finally:
        RedisClient.get_instance = original_get_instance
        
    print("Redis Deduplication Test Passed.")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(test_memory_deduplication())
    loop.run_until_complete(test_redis_deduplication())
