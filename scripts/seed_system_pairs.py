import asyncio
import sys
import os
import json
import random

# Add project root to path
sys.path.append(os.getcwd())

from app.db.session import AsyncSessionLocal
from app.models.base import BenchmarkCase
from sqlalchemy import delete

async def main():
    print("Generating System Instruction Pairs...")
    
    cases = []
    
    # Helper to add cases
    def add_case(questions, name, params):
        answer = json.dumps({"name": name, "parameters": params}, ensure_ascii=False)
        for q in questions:
            cases.append(BenchmarkCase(
                question=q,
                answer=answer,
                intent="instruction"
            ))

    # 1. voice_cmd_start_cooking
    add_case([
        "开始烹饪", "启动烹饪", "开始热饭", "启动微波炉", "开始工作", 
        "热一下", "加热开始", "运行微波炉", "开启加热", "开始烹调",
        "帮我热一下", "立刻开始", "Start cooking", "启动"
    ], "voice_cmd_start_cooking", {})

    # 2. voice_cmd_pause_cooking
    add_case([
        "暂停烹饪", "暂停一下", "先停一下", "暂停微波炉", "暂停加热",
        "等一下", "Pause cooking", "暂停工作", "停一停", "暂停运行",
        "暂缓烹饪", "暂停"
    ], "voice_cmd_pause_cooking", {})

    # 3. voice_cmd_continue_cooking
    add_case([
        "继续烹饪", "恢复烹饪", "继续加热", "继续工作", "恢复运行",
        "继续", "Continue cooking", "回到烹饪", "接着热", "恢复加热",
        "取消暂停", "继续运行"
    ], "voice_cmd_continue_cooking", {})

    # 4. voice_cmd_stop_cooking
    add_case([
        "停止烹饪", "终止烹饪", "结束烹饪", "关掉微波炉", "停止加热",
        "取消烹饪", "Stop cooking", "退出烹饪", "别热了", "关机",
        "停止工作", "结束运行", "终止"
    ], "voice_cmd_stop_cooking", {})

    # 5. remaining_cooking_time_query
    add_case([
        "还有多久", "剩余时间", "还要热多久", "烹饪还要多久", "查看剩余时间",
        "还剩多少时间", "什么时候好", "多久能好", "查询时间", "剩余时长",
        "还有几分钟", "时间查询"
    ], "remaining_cooking_time_query", {})

    # 6. cooking_unfreeze (解冻)
    foods = ["猪肉", "牛肉", "羊肉", "鱼", "鸡肉", "排骨", "饺子", "馒头"]
    for f in foods:
        add_case([
            f"解冻{f}", f"帮我解冻{f}", f"把{f}解冻一下", f"{f}解冻",
            f"我要解冻{f}", f"设置解冻模式{f}"
        ], "cooking_unfreeze", {"food": f})
    add_case(["解冻", "我要解冻", "开启解冻模式", "解冻食物"], "cooking_unfreeze", {})

    # 7. set_cooking_temp (20-100)
    for temp in [30, 40, 50, 60, 70, 80, 90, 100]:
        add_case([
            f"温度设为{temp}度", f"设置温度{temp}", f"调到{temp}度", f"火力温度{temp}",
            f"加热温度{temp}", f"把温度调到{temp}", f"温度{temp}", f"{temp}度"
        ], "set_cooking_temp", {"cooking_temp": temp})

    # 8. set_firepower_time
    firepowers = ["小火", "中火", "大火"]
    times = [(30, "30秒"), (60, "1分钟"), (300, "5分钟"), (600, "10分钟")]
    for fp in firepowers:
        for sec, text in times:
            add_case([
                f"{fp}加热{text}", f"用{fp}热{text}", f"{fp}{text}", 
                f"设置{fp}时间{text}", f"开启{fp}模式{text}"
            ], "set_firepower_time", {"firepower": fp, "duration": sec})

    # 9. set_firepower
    for fp in firepowers:
        add_case([
            f"设置{fp}", f"调成{fp}", f"用{fp}", f"切换到{fp}", f"开启{fp}",
            f"{fp}模式", f"换成{fp}"
        ], "set_firepower", {"firepower": fp})

    # 10. set_cooking_time
    for sec, text in times:
        add_case([
            f"设置时间{text}", f"定时{text}", f"加热{text}", f"时间设为{text}",
            f"烹饪{text}", f"热{text}"
        ], "set_cooking_time", {"duration": sec})

    # 11. jump_to_page
    pages = {
        "使用帮助页": ["打开帮助", "查看帮助", "使用说明", "帮助页面", "怎么用"],
        "语言切换页": ["切换语言", "语言设置", "换个语言", "设置语言", "语言选择"],
        "设备信息页": ["设备信息", "查看设备信息", "系统信息", "版本信息", "关于本机"],
        "网络设置页": ["网络设置", "连接WiFi", "设置网络", "WiFi设置", "配置网络"],
        "设置页": ["打开设置", "系统设置", "进入设置", "设置页面", "设置"]
    }
    for page, queries in pages.items():
        add_case(queries, "jump_to_page", {"page_name": page})

    # 12. back_home_page
    add_case([
        "返回首页", "回到主页", "退出到桌面", "主页", "首页",
        "返回主菜单", "退出当前页面", "Back home", "回首页", "主界面"
    ], "back_home_page", {})

    # 13. volume_up
    add_case([
        "调高音量", "大点声", "音量大一点", "声音大点", "增大音量",
        "加音量", "音量加", "提高音量", "声音太小了", "Volume up"
    ], "volume_up", {})
    # With params
    for v in [10, 20]:
        add_case([f"音量调大{v}", f"声音加大{v}"], "volume_up", {"volume_value": v})

    # 14. volume_down
    add_case([
        "调低音量", "小点声", "音量小一点", "声音小点", "减小音量",
        "减音量", "音量减", "降低音量", "声音太大了", "Volume down"
    ], "volume_down", {})
    # With params
    for v in [10, 20]:
        add_case([f"音量调小{v}", f"声音减小{v}"], "volume_down", {"volume_value": v})

    # 15. volume_value
    for v in [10, 30, 50, 80, 100]:
        add_case([
            f"音量调到{v}", f"设置音量{v}", f"声音{v}", f"音量设为{v}",
            f"把声音调到{v}", f"音量{v}"
        ], "volume_value", {"volume_value": v})

    # 16. volume_max
    add_case([
        "最大音量", "声音调到最大", "音量最大", "最高音量", "最响",
        "声音全开", "Max volume"
    ], "volume_max", {})

    # 17. bright_up
    add_case([
        "调高亮度", "亮一点", "屏幕亮一点", "增加亮度", "调亮屏幕",
        "太暗了", "亮度加", "提高亮度"
    ], "bright_up", {})

    # 18. bright_down
    add_case([
        "调低亮度", "暗一点", "屏幕暗一点", "降低亮度", "调暗屏幕",
        "太亮了", "亮度减", "减小亮度"
    ], "bright_down", {})

    # 19. bright_value
    for v in [20, 50, 80, 100]:
        add_case([
            f"亮度调到{v}", f"设置亮度{v}", f"屏幕亮度{v}", f"亮度设为{v}",
            f"把亮度调到{v}"
        ], "bright_value", {"bright_value": v})

    # 20. bright_max
    add_case([
        "最大亮度", "最亮", "屏幕调到最亮", "最高亮度", "亮度全开"
    ], "bright_max", {})

    # 21. bright_min
    add_case([
        "最小亮度", "最暗", "屏幕调到最暗", "最低亮度", "亮度最低"
    ], "bright_min", {})

    # 22. role_switch
    for i in range(1, 6):
        add_case([
            f"切换到第{i}个角色", f"换成第{i}个", f"使用角色{i}", f"选择第{i}个语音助手",
            f"换第{i}个声音"
        ], "role_switch", {"ordinal": f"第{i}"})

    # 23. screen_off
    add_case([
        "息屏", "关闭屏幕", "黑屏", "关屏", "休眠屏幕",
        "待机", "锁屏", "屏幕熄灭", "Turn off screen"
    ], "screen_off", {})

    # 24. screen_off_timeout
    timeouts = ["15 秒", "30 秒", "1 分钟", "2 分钟", "5 分钟", "10 分钟", "永不"]
    for t in timeouts:
        add_case([
            f"设置息屏时间{t}", f"{t}后息屏", f"屏幕休眠时间{t}", f"设置{t}关屏",
            f"{t}后黑屏"
        ], "screen_off_timeout", {"timeout": t})

    # 25. mute
    add_case([
        "静音", "开启静音", "不要说话", "安静", "闭嘴",
        "Mute", "关闭声音", "静音模式"
    ], "mute", {})

    # 26. unmute
    add_case([
        "取消静音", "解除静音", "恢复声音", "说话", "打开声音",
        "Unmute", "退出静音"
    ], "unmute", {})

    # 27. select_list_id
    for i in range(1, 6):
        add_case([
            f"选择第{i}个", f"打开第{i}个", f"看第{i}个", f"选{i}",
            f"第{i}个", f"我要看第{i}个"
        ], "select_list_id", {"ordinal": f"第{i}"})

    # 28. child_lock_on
    add_case([
        "开启童锁", "打开儿童锁", "锁定屏幕", "开启儿童保护", "锁住",
        "启动童锁", "Child lock on"
    ], "child_lock_on", {})

    # 29. child_lock_off
    add_case([
        "关闭童锁", "解除儿童锁", "解锁屏幕", "关闭儿童保护", "解锁",
        "退出童锁", "Child lock off"
    ], "child_lock_off", {})

    # 30. set_theme_next
    add_case([
        "下一个主题", "切换主题", "换个主题", "下一个皮肤", "更换主题",
        "Next theme", "换个背景"
    ], "set_theme_next", {})
    # Specific ordinal
    for i in range(1, 4):
        add_case([f"切换到第{i}个主题", f"换第{i}个主题"], "set_theme_next", {"ordinal": f"第{i}"})

    # 31. set_theme_previous
    add_case([
        "上一个主题", "切回上一个", "换回原来的", "上个皮肤", "Previous theme"
    ], "set_theme_previous", {})

    # 32. set_taste
    tastes = ["脆嫩", "软糯", "焦一点", "默认"]
    for t in tastes:
        add_case([
            f"我要{t}的", f"口感{t}", f"设置口感为{t}", f"喜欢{t}",
            f"做{t}一点"
        ], "set_taste", {"taste": t})

    # 33. set_foodtype
    foods = ["红烧肉", "排骨", "鱼", "鸡翅", "米饭"]
    for f in foods:
        add_case([
            f"我要做{f}", f"烹饪{f}", f"做{f}", f"选择{f}", f"煮{f}"
        ], "set_foodtype", {"food": f})

    # 34. set_foodtype_taste
    for f in ["红烧肉", "排骨"]:
        for t in ["软烂", "默认"]:
            add_case([
                f"做{t}的{f}", f"{f}要{t}点", f"烹饪{f}口感{t}",
                f"我要吃{t}的{f}"
            ], "set_foodtype_taste", {"food": f, "taste": t})

    # 35. set_food_cooking_temp
    for f in ["牛奶", "咖啡"]:
        for temp in [50, 60]:
            add_case([
                f"{f}加热到{temp}度", f"把{f}热到{temp}度", f"{f}温度{temp}",
                f"设置{f}温度{temp}"
            ], "set_food_cooking_temp", {"food": f, "cooking_temp": temp})

    # 36. AI_cooking_page_open
    add_case([
        "打开智能烹饪", "进入智能烹饪", "AI烹饪", "智慧烹饪", "打开AI烹饪页",
        "我要智能烹饪"
    ], "AI_cooking_page_open", {})

    # 37. DIY_cooking_page_open
    add_case([
        "打开自助烹饪", "进入自助烹饪", "DIY烹饪", "手动烹饪", "自定义烹饪",
        "我要手动做饭"
    ], "DIY_cooking_page_open", {})

    # 38. heat_cooking_page_open
    add_case([
        "打开智能复热", "进入复热", "加热模式", "定温加热", "复热",
        "热饭模式", "恒温加热"
    ], "heat_cooking_page_open", {})

    # DB Operations
    async with AsyncSessionLocal() as db:
        print(f"Total cases generated: {len(cases)}")
        # Delete existing instruction cases to avoid duplicates
        # print("Deleting old instruction cases...")
        # await db.execute(delete(BenchmarkCase).where(BenchmarkCase.intent == 'instruction'))
        
        print("Inserting new cases...")
        db.add_all(cases)
        await db.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
