import asyncio
import sys
import os
import json

# Add project root to path
sys.path.append(os.getcwd())

from app.db.session import AsyncSessionLocal
from app.models.base import BenchmarkCase
from sqlalchemy import delete, select
from app.services.instruction_matcher import matcher_service

async def verify():
    print("--- Starting Verification ---")
    
    async with AsyncSessionLocal() as db:
        # 1. Clear existing System Pairs
        print("\n[Step 1] Clearing existing BenchmarkCase (System Pairs)...")
        await db.execute(delete(BenchmarkCase))
        await db.commit()
        print("Done.")

        # 2. Initialize Matcher (Seeds DB from JSON, then loads from DB)
        print("\n[Step 2] Initializing Matcher (Seeding DB from Defaults + Loading)...")
        await matcher_service.reload(db)
        
        # Verify DB is populated
        result = await db.execute(select(BenchmarkCase))
        cases = result.scalars().all()
        print(f"DB now contains {len(cases)} instruction pairs.")
        if len(cases) == 0:
            print("FAIL: DB should not be empty after reload/seed!")
            
        # Test Default Match (Strategy 1 & 2: Volume)
        query = "把音量调到50"
        print(f"\n[Test] Matching Default: '{query}'")
        match = matcher_service.match(query)
        if match:
            print(f"Match Success! Source: {match.get('source')}")
            print(f"Result: {json.dumps(match['result'], ensure_ascii=False)}")
        else:
            print("Match Failed!")

        # Test Generalization on Default
        query_gen = "音量设为88" # "音量设为30" is in defaults
        print(f"\n[Test] Matching Generalized Default: '{query_gen}'")
        match = matcher_service.match(query_gen)
        if match:
            print(f"Match Success! Result: {json.dumps(match['result'], ensure_ascii=False)}")
            # Verify parameter injection
            val = match['result']['parameters']['value']
            if val == 88:
                print("PASS: Parameter 88 correctly injected.")
            else:
                print(f"FAIL: Expected 88, got {val}")
        else:
            print("Match Failed!")

        # 3. Simulate Manual Learning (Global Batch Feedback -> DB)
        print("\n[Step 3] Simulating Manual Learning...")
        new_query = "空调温度调到49度"
        new_json = {
            "name": "set_ac_temperature",
            "parameters": {"temperature": 49}
        }
        
        # Manually add to DB via Matcher Service helper (or manual DB add + reload)
        # Using generalize_and_save is the "service way"
        print(f"Learning: '{new_query}' -> {json.dumps(new_json)}")
        await matcher_service.generalize_and_save(new_query, new_json, db)
        
        # 4. Test New Knowledge Generalization
        test_query = "空调温度调到18度"
        print(f"\n[Test] Matching Newly Learned (Generalized): '{test_query}'")
        match = matcher_service.match(test_query)
        if match:
            print(f"Match Success! Template: {match.get('template_pattern')}")
            print(f"Result: {json.dumps(match['result'], ensure_ascii=False)}")
            val = match['result']['parameters']['temperature']
            if val == 18:
                print("PASS: Parameter 18 correctly injected.")
            else:
                print(f"FAIL: Expected 18, got {val}")
        else:
            print("Match Failed!")

        # 5. Test Long Tail / Edge Case
        edge_query = "退出"
        print(f"\n[Test] Matching Edge Case: '{edge_query}'")
        match = matcher_service.match(edge_query)
        if match:
             print(f"Match Success! Result: {json.dumps(match['result'], ensure_ascii=False)}")
        else:
             print("Match Failed!")

    print("\n--- Verification Complete ---")

if __name__ == "__main__":
    asyncio.run(verify())
