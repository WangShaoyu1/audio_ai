import asyncio
import sys
import os
import aiohttp
import json

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api/v1/benchmark"

async def test_crud():
    async with aiohttp.ClientSession() as session:
        # 1. Create
        print("Testing Create...")
        case_data = {
            "question": "Test Question",
            "answer": "Test Answer",
            "intent": "test_intent"
        }
        async with session.post(BASE_URL + "/", json=case_data) as resp:
            if resp.status != 200:
                print(f"Create failed: {await resp.text()}")
                return
            created_case = await resp.json()
            print(f"Created: {created_case['id']}")
            case_id = created_case['id']

        # 2. List
        print("Testing List...")
        async with session.get(BASE_URL + "/") as resp:
            if resp.status != 200:
                print(f"List failed: {await resp.text()}")
                return
            data = await resp.json()
            items = data['items']
            found = any(item['id'] == case_id for item in items)
            print(f"List success. Found created case: {found}")

        # 3. Update
        print("Testing Update...")
        update_data = {
            "question": "Updated Question",
            "answer": "Updated Answer"
        }
        async with session.put(f"{BASE_URL}/{case_id}", json=update_data) as resp:
            if resp.status != 200:
                print(f"Update failed: {await resp.text()}")
                return
            updated_case = await resp.json()
            print(f"Updated: {updated_case['question']}")
            assert updated_case['question'] == "Updated Question"

        # 4. Delete
        print("Testing Delete...")
        async with session.delete(f"{BASE_URL}/{case_id}") as resp:
            if resp.status != 200:
                print(f"Delete failed: {await resp.text()}")
                return
            print("Delete success")

        # 5. Verify Delete
        async with session.get(BASE_URL + "/") as resp:
            data = await resp.json()
            items = data['items']
            found = any(item['id'] == case_id for item in items)
            print(f"Verify Delete: Case found? {found}")
            assert not found

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_crud())
