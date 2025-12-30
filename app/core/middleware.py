from fastapi import Request
from fastapi.responses import JSONResponse
import time
import logging
import uuid

logger = logging.getLogger("api")

async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    logger.info(f"Request {request_id} started: {request.method} {request.url}")
    
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(f"Request {request_id} completed: {response.status_code} in {process_time:.2f}ms")
        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"Request {request_id} failed: {str(e)} in {process_time:.2f}ms")
        return JSONResponse(
            status_code=500,
            content={"code": 500, "message": "Internal Server Error", "request_id": request_id}
        )
