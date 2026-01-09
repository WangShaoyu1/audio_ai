from fastapi import Request
from fastapi.responses import JSONResponse
import time
import uuid
from app.core.logger import logger

async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Add request_id to context
    with logger.contextualize(request_id=request_id):
        logger.info(f"Request started: {request.method} {request.url}")
        
        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            logger.info(f"Request completed: {response.status_code} in {process_time:.2f}ms")
            
            # Add request_id to response headers
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            logger.exception(f"Request failed: {str(e)} in {process_time:.2f}ms")
            return JSONResponse(
                status_code=500,
                content={"code": 500, "message": "Internal Server Error", "request_id": request_id}
            )
