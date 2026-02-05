import re
import json
import copy
from typing import List, Dict, Any, Optional

class InstructionMatcher:
    def __init__(self):
        self.templates = []
    
    def _is_number(self, s):
        try:
            float(s)
            return True
        except ValueError:
            return False

    def generalize_instruction(self, query: str, json_response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Step 1: 离线/预处理阶段
        将原始指令对转化为泛化模版。
        例如：
        输入 Query: "音量调到37"
        输入 JSON: {"name": "volume_value", "parameters": {"volume_value": 37}}
        
        输出 Template: {
            "pattern": "音量调到{num}",
            "json_template": {"name": "volume_value", "parameters": {"volume_value": "{num}"}},
            "param_types": {"{num}": "number"}
        }
        """
        template_pattern = query
        template_json = copy.deepcopy(json_response)
        param_types = {}
        
        # 简单的正则匹配数字
        # 实际生产中可以使用 NLP 实体识别 (NER) 来识别时间、地点等
        numbers = re.findall(r'\d+', query)
        
        # 这里的逻辑是：如果 Query 里有数字，且 JSON 参数里也有相同的数字，就认为它们是关联的
        for idx, num_str in enumerate(numbers):
            placeholder = f"{{num_{idx}}}"
            
            # 1. 替换 Query 中的数字为占位符
            template_pattern = template_pattern.replace(num_str, placeholder, 1)
            
            # 2. 替换 JSON 中的数字为占位符 (递归查找)
            num_val = int(num_str) if num_str.isdigit() else float(num_str)
            self._replace_json_value(template_json, num_val, placeholder)
            
            param_types[placeholder] = "number"
            
        return {
            "pattern": template_pattern, # e.g., "音量调到{num_0}"
            "json_template": template_json, # e.g., {..., "volume_value": "{num_0}"}
            "param_types": param_types,
            "original_query": query
        }

    def _replace_json_value(self, obj: Any, target_val: Any, placeholder: str):
        """递归替换 JSON 中的值"""
        if isinstance(obj, dict):
            for k, v in obj.items():
                if v == target_val:
                    obj[k] = placeholder
                elif isinstance(v, (dict, list)):
                    self._replace_json_value(v, target_val, placeholder)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                if v == target_val:
                    obj[i] = placeholder
                elif isinstance(v, (dict, list)):
                    self._replace_json_value(v, target_val, placeholder)

    def add_instruction(self, query: str, json_response: Dict[str, Any]):
        template = self.generalize_instruction(query, json_response)
        self.templates.append(template)
        # print(f"[Learn] '{query}' -> Template: '{template['pattern']}'")

    def match(self, user_query: str) -> Optional[Dict[str, Any]]:
        """
        Step 2 & 3: 在线匹配与参数注入
        用户输入: "音量调到38"
        
        1. 尝试将 User Query 泛化 (提取其中的数字)
        2. 匹配模版库
        3. 如果匹配成功，提取 38 并注入到 JSON
        """
        # 1. 提取用户输入中的实体
        user_nums = re.findall(r'\d+', user_query)
        
        # 构造用户输入的"骨架" (Skeleton)
        user_pattern = user_query
        user_params = {}
        for idx, num_str in enumerate(user_nums):
            placeholder = f"{{num_{idx}}}"
            user_pattern = user_pattern.replace(num_str, placeholder, 1)
            user_params[placeholder] = int(num_str) if num_str.isdigit() else float(num_str)
            
        # 2. 匹配模版
        # 这里演示的是精确骨架匹配。
        # 生产环境会结合 Vector Search (先找相似骨架) + Edit Distance (微调)
        best_match = None
        for tmpl in self.templates:
            if tmpl["pattern"] == user_pattern:
                best_match = tmpl
                break
        
        if not best_match:
            return None
            
        # 3. 参数注入
        final_json = copy.deepcopy(best_match["json_template"])
        
        # 遍历 JSON 模版，把 {num_0} 换回用户实际输入的 38
        self._inject_params(final_json, user_params)
        
        return {
            "match_type": "dynamic_template",
            "template_used": best_match["pattern"],
            "result": final_json
        }

    def _inject_params(self, obj: Any, params: Dict[str, Any]):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(v, str) and v in params:
                    obj[k] = params[v]
                elif isinstance(v, (dict, list)):
                    self._inject_params(v, params)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                if isinstance(v, str) and v in params:
                    obj[i] = params[v]
                elif isinstance(v, (dict, list)):
                    self._inject_params(v, params)

# --- Test Cases ---
if __name__ == "__main__":
    matcher = InstructionMatcher()
    
    # 1. 模拟系统启动，加载指令库 (WDC2.0 中的几条示例)
    print("=== 初始化指令库 ===")
    matcher.add_instruction(
        "音量调到37", 
        {"name": "volume_value", "parameters": {"volume_value": 37}}
    )
    matcher.add_instruction(
        "设置温度60度",
        {"name": "set_cooking_temp", "parameters": {"cooking_temp": 60}}
    )
    matcher.add_instruction(
        "加热5分钟",
        {"name": "set_cooking_time", "parameters": {"duration": 300}} # 注意：这里 5 -> 300 的映射比较复杂，正则搞不定，需要更高级的逻辑。
        # 简化演示：假设库里有一条 "加热300秒"
    )
    matcher.add_instruction(
        "加热300秒",
        {"name": "set_cooking_time", "parameters": {"duration": 300}}
    )

    print("\n=== 开始测试 ===")
    
    test_cases = [
        "音量调到38",      # 应该匹配 "音量调到{num}"
        "音量调到50",      # 应该匹配 "音量调到{num}"
        "设置温度85度",    # 应该匹配 "设置温度{num}度"
        "加热120秒",       # 应该匹配 "加热{num}秒"
        "音量调大一点"      # 无数字，无法匹配动态模版 (应走普通向量检索)
    ]
    
    for case in test_cases:
        result = matcher.match(case)
        print(f"\nUser Input: '{case}'")
        if result:
            print(f"  -> Match Template: {result['template_used']}")
            print(f"  -> Generated JSON: {json.dumps(result['result'], ensure_ascii=False)}")
        else:
            print("  -> No dynamic match found (Fallback to Vector Search)")
