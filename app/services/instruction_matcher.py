import re
import json
import copy
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.base import BenchmarkCase
from app.models.instruction import InstructionRepository
from app.core.config import settings
import os
import asyncio
import uuid

logger = logging.getLogger(__name__)

class InstructionMatcher:
    def __init__(self):
        self.templates = []
    
    def _flatten_json(self, obj: Any, parent_key: str = '', sep: str = '.') -> List[Dict[str, Any]]:
        """
        Flatten JSON to list of {path: 'a.b', value: val}
        """
        items = []
        if isinstance(obj, dict):
            for k, v in obj.items():
                new_key = f"{parent_key}{sep}{k}" if parent_key else k
                items.extend(self._flatten_json(v, new_key, sep=sep))
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                new_key = f"{parent_key}{sep}{i}" if parent_key else str(i)
                items.extend(self._flatten_json(v, new_key, sep=sep))
        else:
            items.append({"path": parent_key, "value": obj})
        return items

    def _set_value_by_path(self, obj: Any, path: str, value: Any, sep: str = '.'):
        """Sets value in nested dict/list by dot-notation path."""
        parts = path.split(sep)
        curr = obj
        for i, part in enumerate(parts[:-1]):
            if isinstance(curr, list):
                idx = int(part)
                curr = curr[idx]
            else:
                curr = curr[part]
        
        last = parts[-1]
        if isinstance(curr, list):
            curr[int(last)] = value
        else:
            curr[last] = value

    def generalize_instruction(self, query: str, json_response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generalizes a specific instruction into a regex template.
        """
        # 1. Extract all leaf values from JSON
        leaves = self._flatten_json(json_response)
        
        # 2. Filter values that are actually present in the query
        matches = []
        for leaf in leaves:
            val_str = str(leaf['value'])
            # Skip very short matches to avoid noise (e.g. "1") unless it's the whole query?
            # For now, let's allow everything but require strict substring match.
            if val_str in query:
                # Find ALL occurrences? No, just first one for simplicity or we get complex overlaps.
                # Or we can support multiple parameters.
                start_idx = query.find(val_str)
                matches.append({
                    "val_str": val_str,
                    "start": start_idx,
                    "end": start_idx + len(val_str),
                    "path": leaf['path'],
                    "value": leaf['value']
                })
        
        # 3. Sort matches by position and remove overlaps
        matches.sort(key=lambda x: x['start'])
        
        final_matches = []
        last_end = 0
        for m in matches:
            if m['start'] >= last_end:
                final_matches.append(m)
                last_end = m['end']
        
        # 4. Build Regex and Template JSON
        regex_parts = []
        current_idx = 0
        param_map = {} # param_name -> path
        template_json = copy.deepcopy(json_response)
        
        for i, m in enumerate(final_matches):
            # Static part before this param
            static_text = query[current_idx:m['start']]
            if static_text:
                regex_parts.append(re.escape(static_text))
            
            # Param part
            param_name = f"p_{i}"
            
            # Determine regex type based on value type
            if isinstance(m['value'], (int, float)):
                 # Number: \d+ or \d+(\.\d+)?
                 regex_parts.append(f"(?P<{param_name}>\\d+(?:\\.\\d+)?)")
            else:
                 # String: .+? (Non-greedy match)
                 regex_parts.append(f"(?P<{param_name}>.+?)")
            
            # Update mapping
            param_map[param_name] = m['path']
            
            # Update JSON template with placeholder (for debugging/reference)
            # self._set_value_by_path(template_json, m['path'], f"{{{{{param_name}}}}}")
            
            current_idx = m['end']
            
        # Tail
        tail_text = query[current_idx:]
        if tail_text:
            regex_parts.append(re.escape(tail_text))
        
        full_regex = "^" + "".join(regex_parts) + "$"
        
        return {
            "pattern": full_regex,
            "json_template": template_json,
            "param_map": param_map,
            "original_query": query
        }

    def add_instruction(self, query: str, json_response: Dict[str, Any], repository_id: Optional[uuid.UUID] = None):
        template = self.generalize_instruction(query, json_response)
        template["repository_id"] = repository_id
        
        # Deduplication (avoid adding identical patterns)
        for t in self.templates:
            if t["pattern"] == template["pattern"] and t.get("repository_id") == repository_id:
                return
        self.templates.append(template)

    def has_template(self, query: str, repository_id: Optional[uuid.UUID] = None) -> bool:
        """Checks if a template for the query already exists."""
        # This is a bit ambiguous. If we want to check if the query *matches* an existing template:
        return self.match(query, repository_id) is not None

    def match(self, user_query: str, repository_id: Optional[uuid.UUID] = None) -> Optional[Dict[str, Any]]:
        """
        Matches a user query against templates and injects parameters.
        If repository_id is provided, filters templates by that ID.
        """
        for template in self.templates:
            # Filter by repository_id
            tpl_repo_id = template.get("repository_id")
            
            # Strict isolation:
            # If template has a repo ID, it MUST match the requested repository_id.
            if tpl_repo_id is not None and tpl_repo_id != repository_id:
                continue
            
            # If template is Global (None), it matches everyone? 
            # Or should we enforce strict repo match if repo_id is provided?
            # Let's assume Global templates apply to all.
            
            match = re.match(template["pattern"], user_query, re.IGNORECASE)
            if match:
                groups = match.groupdict()
                result = copy.deepcopy(template["json_template"])
                param_map = template.get("param_map", {})
                
                # Fill values
                for param_name, val_str in groups.items():
                    path = param_map.get(param_name)
                    if path:
                        # Simple type inference
                        final_val = val_str
                        if re.match(r'^\d+$', val_str):
                            final_val = int(val_str)
                        elif re.match(r'^\d+\.\d+$', val_str):
                            final_val = float(val_str)
                        
                        self._set_value_by_path(result, path, final_val)
                
                return {
                    "source": "instruction_matcher",
                    "template_pattern": template["pattern"],
                    "result": result,
                    "repository_id": tpl_repo_id,
                    "original_query": template.get("original_query")
                }
        return None

    def clear(self):
        self.templates = []

    def print_templates(self):
        """Prints all current templates to log for debugging."""
        logger.info(f"=== Current Regex Templates ({len(self.templates)}) ===")
        for i, t in enumerate(self.templates):
            logger.info(f"[{i}] Pattern: {t['pattern']} | Repo: {t.get('repository_id')} | Sample: {t.get('original_query')}")
        logger.info("=============================================")

class InstructionMatcherService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(InstructionMatcherService, cls).__new__(cls)
            cls._instance.matcher = InstructionMatcher()
            cls._instance.default_pairs_path = os.path.join("app", "config", "default_system_pairs.json")
        return cls._instance

    def match(self, query: str, repository_id: Optional[uuid.UUID] = None) -> Optional[Dict[str, Any]]:
        """
        Delegates match request to the internal matcher instance.
        """
        return self.matcher.match(query, repository_id)

    async def reload(self, db: AsyncSession):
        """Reloads templates from Database ONLY (after ensuring defaults are seeded)."""
        # Ensure defaults are seeded first
        await self._ensure_defaults_seeded(db)

        self.matcher.clear()
        
        # Load from DB
        try:
            # Join with Repo to get active version
            stmt = select(BenchmarkCase, InstructionRepository.active_system_version)\
                .outerjoin(InstructionRepository, BenchmarkCase.repository_id == InstructionRepository.id)\
                .where(
                    (BenchmarkCase.source == 'manual') | 
                    (
                        (BenchmarkCase.source == 'system') & 
                        (BenchmarkCase.version == InstructionRepository.active_system_version)
                    )
                )
            
            result = await db.execute(stmt)
            rows = result.all()
            
            count = 0
            for case, active_version in rows:
                try:
                    json_response = json.loads(case.answer)
                    self.matcher.add_instruction(case.question, json_response, repository_id=case.repository_id)
                    count += 1
                except Exception as e:
                    logger.warning(f"Failed to load instruction case {case.id}: {e}")
            
            logger.info(f"Reloaded {count} instruction templates into memory.")
            self.matcher.print_templates()
            
        except Exception as e:
            logger.error(f"Failed to reload instruction matcher: {e}")

    async def generalize_and_save(self, query: str, json_response: Dict[str, Any], db: AsyncSession, repository_id: Optional[uuid.UUID] = None):
        """
        Generalizes an instruction pair and saves it as a manual benchmark case.
        Also updates the in-memory matcher.
        """
        # 1. Add to DB as 'manual' case
        try:
            # Check if duplicates exist?
            # Maybe unnecessary if we trust the matcher's dedupe, but DB unique constraints might exist?
            # BenchmarkCase usually doesn't have unique constraint on question.
            
            case = BenchmarkCase(
                question=query,
                answer=json.dumps(json_response, ensure_ascii=False),
                intent="instruction",
                source="manual",
                version=0,
                repository_id=repository_id
            )
            db.add(case)
            await db.commit()
            await db.refresh(case)
        except Exception as e:
            logger.error(f"Failed to save generalized case to DB: {e}")
            raise e

        # 2. Add to in-memory matcher
        try:
            self.matcher.add_instruction(query, json_response, repository_id=repository_id)
            logger.info(f"Added generalized instruction to memory: {query}")
        except Exception as e:
            logger.error(f"Failed to add instruction to matcher: {e}")

    async def _ensure_defaults_seeded(self, db: AsyncSession):
        """
        Ensures default system pairs are seeded into the database as 'manual' entries (version 0).
        This avoids hardcoding them in the matcher and allows them to be managed/deleted.
        """
        # Check if we have any manual cases
        stmt = select(BenchmarkCase).where(BenchmarkCase.source == 'manual').limit(1)
        result = await db.execute(stmt)
        if result.scalar():
            return

        if not os.path.exists(self.default_pairs_path):
            logger.warning(f"Default pairs file not found: {self.default_pairs_path}")
            return

        try:
            with open(self.default_pairs_path, 'r', encoding='utf-8') as f:
                pairs = json.load(f)
            
            count = 0
            for p in pairs:
                case = BenchmarkCase(
                    question=p['question'],
                    answer=json.dumps(p['answer'], ensure_ascii=False),
                    intent="instruction",
                    source="manual",
                    version=0 # 0 for defaults
                )
                db.add(case)
                count += 1
            
            await db.commit()
            logger.info(f"Seeded {count} default instruction pairs into database.")
        except Exception as e:
            logger.error(f"Failed to seed default pairs: {e}")

matcher_service = InstructionMatcherService()
