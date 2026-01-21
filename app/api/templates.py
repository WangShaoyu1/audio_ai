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

import json
from app.core.default_instructions import DEFAULT_INSTRUCTIONS

@router.get("/templates/instructions")
async def get_instructions_template():
    # Prepare data from DEFAULT_INSTRUCTIONS
    names = []
    descriptions = []
    parameters = []
    mutex_configs = []

    for instr in DEFAULT_INSTRUCTIONS:
        names.append(instr["name"])
        descriptions.append(instr["description"])
        parameters.append(json.dumps(instr["parameters"], ensure_ascii=False))
        mutex_configs.append(json.dumps(instr.get("mutex_config", {"incompatible": []}), ensure_ascii=False))

    df = pd.DataFrame({
        'name': names,
        'description': descriptions,
        'parameters_json': parameters,
        'mutex_config_json': mutex_configs
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
