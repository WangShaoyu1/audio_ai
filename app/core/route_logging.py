from fastapi import Request, Response
from fastapi.routing import APIRoute
from typing import Callable
import time
import uuid
from app.core.logger import logger

class LoggingContextRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            # Generate request_id if not present (middleware might have set it, but we are replacing middleware)
            request_id = str(uuid.uuid4())
            request.state.request_id = request_id
            
            start_time = time.time()
            
            with logger.contextualize(request_id=request_id):
                logger.info(f"[{request_id}] Request started: {request.method} {request.url}")
                
                # Log Request Body
                try:
                    body_bytes = await request.body()
                    
                    # Restore body for downstream (Pydantic parsing)
                    async def receive():
                        return {"type": "http.request", "body": body_bytes}
                    request._receive = receive
                    
                    body_str = body_bytes.decode("utf-8")
                    if len(body_str) > 5000:
                        body_str = body_str[:5000] + "...(truncated)"
                    logger.info(f"[{request_id}] Request Body: {body_str}")
                except Exception as e:
                    logger.warning(f"[{request_id}] Failed to log request body: {e}")

                try:
                    response = await original_route_handler(request)
                    process_time = (time.time() - start_time) * 1000
                    logger.info(f"[{request_id}] Request completed: {response.status_code} in {process_time:.2f}ms")
                    response.headers["X-Request-ID"] = request_id
                    return response
                except Exception as e:
                    process_time = (time.time() - start_time) * 1000
                    logger.exception(f"[{request_id}] Request failed: {str(e)} in {process_time:.2f}ms")
                    raise e
        
        return custom_route_handler
