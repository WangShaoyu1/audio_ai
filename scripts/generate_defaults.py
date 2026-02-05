import json
import os

def generate_default_pairs():
    """
    Generates default system pairs based on strategies:
    1. Synonym rewriting (simulated)
    2. Parameter fuzzing
    3. Contextual scenarios
    """
    
    pairs = []
    
    # --- Strategy 1 & 2: Volume Control (Number Parameter) ---
    # Core intent: VOLUME_SET
    # Target JSON structure
    def volume_json(val):
        return {
            "name": "volume_set",
            "parameters": {"value": val}
        }
    
    volume_seeds = [
        # Standard
        ("把音量调到50", 50),
        ("音量设为30", 30),
        ("声音大小调到20", 20),
        # Colloquial
        ("声音开到80", 80),
        ("给我把音量弄到10", 10),
        ("音量100", 100),
        # Inverted
        ("50分音量", 50),
        # Polite
        ("请帮我把音量调到45", 45),
        ("麻烦声音调到60", 60),
    ]
    
    for q, v in volume_seeds:
        pairs.append({
            "question": q,
            "answer": json.dumps(volume_json(v), ensure_ascii=False),
            "intent": "instruction"
        })

    # --- Strategy 3: Navigation (Contextual) ---
    # Core intent: NAVIGATION
    # Note: My matcher currently handles NUMBERS. 
    # For string entities like "Tiananmen", the current regex \d+ won't generalize them to {str_0}.
    # The user's requirement 3.7.3 specifically mentions "Generalization... Input: Instruction Pair".
    # And my code currently only generalizes numbers.
    # TO SUPPORT TEXT ENTITIES (Strategy 2 "Entity Forms"), I would need NER.
    # However, for the purpose of this task (which focuses on the mechanism), 
    # I will stick to what the code supports (Numbers) OR generic patterns if I had string support.
    # BUT, the user asked to "strictly follow suggestion 1, 2, 3".
    # Suggestion 2 mentions "Entity forms: song names, contacts".
    # If I want to support this without a full NER model, I can't easily generalize "Play Jay Chou".
    # UNLESS I use the LLM to generate the specific pairs and store them as literal matches.
    # The matcher supports literal matching too (it's just a template without placeholders).
    # So I will add these as literal pairs for now, which covers the "enrichment" requirement.
    
    nav_seeds = [
        ("导航去天安门", {"name": "navigation", "parameters": {"destination": "天安门"}}),
        ("带我去故宫", {"name": "navigation", "parameters": {"destination": "故宫"}}),
        ("我想去三里屯", {"name": "navigation", "parameters": {"destination": "三里屯"}}),
    ]
    for q, a in nav_seeds:
        pairs.append({
            "question": q,
            "answer": json.dumps(a, ensure_ascii=False),
            "intent": "instruction"
        })

    # --- Strategy 2: Time/Duration (Number Parameter) ---
    def timer_json(val):
        return {
            "name": "timer_set",
            "parameters": {"duration_seconds": val}
        }
    
    timer_seeds = [
        ("倒计时60秒", 60),
        ("设定一个120秒的闹钟", 120),
        ("提醒我300秒后关火", 300),
        ("10分钟后叫我", 600), # Note: value in query is 10, in json is 600. Generalization might fail here if not careful.
                              # The generalized matcher looks for "10" in JSON. It won't find it.
                              # So for "10 minutes" -> 600 seconds, this specific simple matcher won't generalize "10" -> "600".
                              # It requires logic. I will skip complex logic cases for generalization and stick to direct mapping for now.
        ("定时10秒", 10)
    ]
    for q, v in timer_seeds:
        pairs.append({
            "question": q,
            "answer": json.dumps(timer_json(v), ensure_ascii=False),
            "intent": "instruction"
        })

    # --- Strategy 4: Long Tail / Edge Cases ---
    # Negative samples or specific fixed commands
    edge_cases = [
        ("你好", {"name": "chat", "parameters": {}}), # Should be chat, but if forced as instruction
        ("退出", {"name": "system", "parameters": {"action": "exit"}}),
        ("关闭", {"name": "system", "parameters": {"action": "close"}}),
    ]
    for q, a in edge_cases:
        pairs.append({
            "question": q,
            "answer": json.dumps(a, ensure_ascii=False),
            "intent": "instruction"
        })

    # Ensure directory exists
    output_dir = os.path.join("app", "config")
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "default_system_pairs.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(pairs, f, ensure_ascii=False, indent=2)
    
    print(f"Generated {len(pairs)} default system pairs at {output_path}")

if __name__ == "__main__":
    generate_default_pairs()
