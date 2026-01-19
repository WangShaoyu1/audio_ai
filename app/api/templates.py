from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.core.route_logging import LoggingContextRoute
import io
import pandas as pd

router = APIRouter(route_class=LoggingContextRoute)

@router.get("/templates/batch-eval")
async def get_batch_eval_template():
    df = pd.DataFrame({
        'query': ['Example query 1', 'Example query 2'],
        'expected_intent': ['intent_name_1', 'intent_name_2'],
        'expected_slots': ['{"slot1": "value1"}', '{}']
    })
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=batch_eval_template.xlsx"}
    )

@router.get("/templates/instructions")
async def get_instructions_template():
    df = pd.DataFrame({
        'name': ['instruction_name'],
        'description': ['Description of the instruction'],
        'parameters': ['{"param1": "string"}'],
        'mutex_config': ['{"incompatible": []}']
    })
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=instructions_template.xlsx"}
    )
