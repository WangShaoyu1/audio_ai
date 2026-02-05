import asyncio
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from app.db.session import AsyncSessionLocal
from sqlalchemy import select
from app.models.instruction import InstructionRepository, Instruction

async def main():
    async with AsyncSessionLocal() as db:
        print("Checking Instruction Repositories...")
        result = await db.execute(select(InstructionRepository))
        repos = result.scalars().all()
        
        found_wdc = False
        for repo in repos:
            print(f"Repo: {repo.name} (ID: {repo.id})")
            # Get instructions count
            stmt = select(Instruction).where(Instruction.repository_id == repo.id)
            instructions = (await db.execute(stmt)).scalars().all()
            print(f"  - Instructions count: {len(instructions)}")
            if "WDC" in repo.name:
                found_wdc = True
                print(f"  - Found {repo.name}! Dumping instructions to file...")
                with open("wdc_instructions.txt", "w", encoding="utf-8") as f:
                    for inst in instructions:
                        f.write(f"Name: {inst.name}\n")
                        f.write(f"Desc: {inst.description}\n")
                        f.write(f"Params: {inst.parameters}\n")
                        f.write("-" * 20 + "\n")
                print("  - Dumped to wdc_instructions.txt")
        
        if not found_wdc:
            print("WDC2.0 repository not found in database.")

if __name__ == "__main__":
    asyncio.run(main())
