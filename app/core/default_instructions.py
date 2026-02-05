
DEFAULT_INSTRUCTIONS = {
    "zh": [
        {
            "name": "voice_cmd_start_cooking",
            "description": "启动烹饪，帮助用户启动万得厨微波炉开始烹饪食物",
            "parameters": {}
        },
        {
            "name": "voice_cmd_pause_cooking",
            "description": "暂停烹饪，帮助用户暂停万得厨微波炉的烹饪进程",
            "parameters": {}
        },
        {
            "name": "voice_cmd_continue_cooking",
            "description": "继续烹饪，帮助用户继续/恢复万得厨微波炉的烹饪进程",
            "parameters": {}
        },
        {
            "name": "voice_cmd_stop_cooking",
            "description": "终止烹饪，帮助用户终止/结束/退出万得厨微波炉的烹饪进程",
            "parameters": {}
        },
        {
            "name": "remaining_cooking_time_query",
            "description": "播报烹饪剩余时间，告知用户当前万得厨微波炉烹饪的剩余时长",
            "parameters": {}
        },
        {
            "name": "cooking_unfreeze",
            "description": "解冻，帮助用户设置解冻模式后直接进入启动程序",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "要解冻的食材、食品名称（非必须），例如猪肉、牛肉、羊肉、烤肠、梅菜扣肉、鳗鱼炒饭、猪肉玉米水饺等。"
                    }
                }
            }
        },
        {
            "name": "set_cooking_temp",
            "description": "设置烹饪温度，帮助用户设置烹饪/加热的温度值",
            "parameters": {
                "type": "object",
                "properties": {
                    "cooking_temp": {
                        "type": "number",
                        "description": "要设置的烹饪温度，取值范围 20-100，单位为度，例如35、54、60、89 等。"
                    }
                },
                "required": [
                    "cooking_temp"
                ]
            }
        },
        {
            "name": "set_firepower_time",
            "description": "设置火力+时间，帮助用户设置烹饪/加热的火力模式和时间",
            "parameters": {
                "type": "object",
                "properties": {
                    "firepower": {
                        "type": "string",
                        "enum": [
                            "小火",
                            "中火",
                            "大火"
                        ],
                        "description": "要设置的火力模式，取值范围不能超出’enum‘， 但若有相近值可转化为’enum‘中的值。\n 小火的相近值有[低火、微火、最小火]；中火的相近值有["
                                       "中等火力、中档火]；大火的相近值有[高火、最大火力、最高火力、最大火、最高火]。"
                    },
                    "duration": {
                        "type": "number",
                        "description": "要设置的烹饪烹饪时长，单位为秒（s），请将其他单位转化为秒，例如 100s、七分钟=420s、五分半=330s，时间最长为 40 分钟。"
                    }
                },
                "required": [
                    "firepower",
                    "duration"
                ]
            }
        },
        {
            "name": "set_firepower",
            "description": "设置火力，帮助用户设置烹饪/加热的火力模式",
            "parameters": {
                "type": "object",
                "properties": {
                    "firepower": {
                        "type": "string",
                        "enum": [
                            "小火",
                            "中火",
                            "大火"
                        ],
                        "description": "要设置的火力模式，取值范围不能超出’enum‘， 但若有相近值可转化为’enum‘中的值。\n 小火的相近值有[低火、微火、最小火]；中火的相近值有["
                                       "中等火力、中档火]；大火的相近值有[高火、最大火力、最高火力、最大火、最高火]。"
                    }
                },
                "required": [
                    "firepower"
                ]
            }
        },
        {
            "name": "set_cooking_time",
            "description": "设置烹饪时间，帮助用户设置烹饪/加热的时间",
            "parameters": {
                "type": "object",
                "properties": {
                    "duration": {
                        "type": "number",
                        "description": "要设置的烹饪烹饪时长，单位为秒（s），请将其他单位转化为秒，例如 100s、七分钟=420s、五分半=330s。"
                    }
                },
                "required": [
                    "duration"
                ]
            }
        },
        {
            "name": "jump_to_page",
            "description": "打开指定页面，帮助用户跳转/进入/切换到指定页面",
            "parameters": {
                "type": "object",
                "properties": {
                    "page_name": {
                        "type": "string",
                        "enum": [
                            "使用帮助页",
                            "语言切换页",
                            "设备信息页",
                            "网络设置页",
                            "设置页"
                        ],
                        "description": "要打开的页面名称，取值范围不能超出’enum‘， 但若有相近值可转化为’enum‘中的值。\n 使用帮助页的相近值有["
                                       "使用帮助、使用指南、使用说明、帮助页、帮助、系统帮助]；设置页的相近值有[设置、系统设置]；\n 语言切换页的相近值有["
                                       "语言切换、语言选择、选择语言、语言更换、换语言、切换语言]；智能烹饪页的相近值有[智能烹饪、AI 烹饪情]；\n 设备信息页的相近值有["
                                       "设备信息、设备详情、设备信息详情]；\n 网络设置页的相近值有[网络设置、联网、WiFi 设置、WiFi 连接、WiFi、wifi、wifi 设置、网络信息]。"
                    }
                },
                "required": [
                    "page_name"
                ]
            }
        },
        {
            "name": "back_home_page",
            "description": "返回首页，帮助用户回到/进入/跳转到首页/主页",
            "parameters": {}
        },
        {
            "name": "volume_up",
            "description": "调高音量，帮助用户增大/提高/升高音量",
            "parameters": {
                "type": "object",
                "properties": {
                    "volume_value": {
                        "type": "number",
                        "description": "要增加的音量值（默认值为 10），取值范围 1-100，例如35%=35、百分之五十=50 等。"
                    }
                }
            }
        },
        {
            "name": "volume_down",
            "description": "调低音量，帮助用户减小/降低/调小音量",
            "parameters": {
                "type": "object",
                "properties": {
                    "volume_value": {
                        "type": "number",
                        "description": "要降低的音量值（默认值为 10），取值范围 1-100，例如35%=35、百分之五十=50 等。"
                    }
                }
            }
        },
        {
            "name": "volume_value",
            "description": "设置音量为目标值，帮助用户将音量调节/设置/到指定值",
            "parameters": {
                "type": "object",
                "properties": {
                    "volume_value": {
                        "type": "number",
                        "description": " 要设 置的目标音量 值，取值 范围 0-100，例如10、35%=35、百分之五十=50、0 等。"
                    }
                },
                "required": [
                    "volume_value"
                ]
            }
        },
        {
            "name": "volume_max",
            "description": "设置最高音量，帮助用户将音量调整/设置/到最高值",
            "parameters": {}
        },
        {
            "name": "bright_up",
            "description": "调高亮度，帮助用户增大/提高/升高屏幕亮度",
            "parameters": {
                "type": "object",
                "properties": {
                    "bright_value": {
                        "type": "number",
                        "description": "要增加的亮度值（默认值为 10），取值范围 1-100，例如35%=35、百分之五十=50 等。"
                    }
                }
            }
        },
        {
            "name": "bright_down",
            "description": "调低亮度，帮助用户减少/降低/调小屏幕亮度",
            "parameters": {
                "type": "object",
                "properties": {
                    "bright_value": {
                        "type": "number",
                        "description": "要降低的亮度值（默认值为 10），取值范围 1-100，例如35%=35、百分之五十=50 等。"
                    }
                }
            }
        },
        {
            "name": "bright_value",
            "description": "设置亮度为目标值，帮助用户将屏幕亮度调节/设置/调整到指定值",
            "parameters": {
                "type": "object",
                "properties": {
                    "bright_value": {
                        "type": "number",
                        "description": " 要设 置的目标亮度值，取值 范围 0-100，例如10、35%=35、百分之五十=50、0 等。"
                    }
                },
                "required": [
                    "bright_value"
                ]
            }
        },
        {
            "name": "bright_max",
            "description": "设置最高亮度，帮助用户将屏幕亮度调整/设置/到最大值",
            "parameters": {}
        },
        {
            "name": "bright_min",
            "description": "设置最低亮度，帮助用户将屏幕亮度调整/设置/到最小值",
            "parameters": {}
        },
        {
            "name": "role_switch",
            "description": "切换角色，帮助用户调整/设置/更换或使用指定的虚拟人/语音助手角色",
            "parameters": {
                "type": "object",
                "properties": {
                    "ordinal": {
                        "type": "string",
                        "description": "要切换的虚拟人角色序号，格式为‘第 N’，N 的取值范围1-100，若有相近描述需转化为标准的格式。\n 例如第 1=编号 1、第 2=编号 2、第51=倒数第 "
                                       "1=最后一=最后 1、第 52=倒数第 2 等。"
                    }
                }
            }
        },
        {
            "name": "screen_off",
            "description": "息屏/黑屏/锁屏/待机/休眠，帮助用户息灭屏幕",
            "parameters": {}
        },
        {
            "name": "screen_off_timeout",
            "description": "设置屏幕进入休眠时间，帮助用户调整/设置/修改/选择屏幕关闭/熄灭/休眠/息屏/黑屏时间",
            "parameters": {
                "type": "object",
                "properties": {
                    "timeout": {
                        "type": "string",
                        "enum": [
                            "15 秒",
                            "30 秒",
                            "1 分钟",
                            "2 分钟",
                            "5 分钟",
                            "10 分钟",
                            "永不"
                        ],
                        "description": "要设置的休眠时间，取值范围不能超出’enum‘， 但若有相近值可转化为’enum‘中的值。\n15 秒的相近值有[十五秒]；30 秒的相近值有[三十秒]；1 "
                                       "分钟的相近值有[1 分、一分钟、一分]；2 分钟的相近值有[2 分、两分钟、二分钟、两分]；\n5 分钟的相近值有[5 分、五分钟、五分]；10 分钟的相近值有["
                                       "10分、十分钟、十分]；永不的相近值有[不休眠、永久]。"
                    }
                }
            }
        },
        {
            "name": "mute",
            "description": "开启静音，帮助用户启用/打开/设置/进入/调到/静音模式",
            "parameters": {}
        },
        {
            "name": "unmute",
            "description": "解除静音，帮助用户关闭/取消/退出静音模式",
            "parameters": {}
        },
        {
            "name": "select_list_id",
            "description": "选择序号，帮助用户在当前页面选择/打开指定序号的食谱/菜谱",
            "parameters": {
                "type": "object",
                "properties": {
                    "ordinal": {
                        "type": "string",
                        "description": "要选择的序号，格式为‘第 N’，N 的取值范围 1-100，若有相近描述需转化为标准的格式。\n 例如第 1=编号 1、第 2=编号 2、第 "
                                       "51=倒数第1=最后一=最后 1、第 52=倒数第 2 等。"
                    }
                },
                "required": [
                    "ordinal"
                ]
            }
        },
        {
            "name": "child_lock_on",
            "description": "锁定儿童锁，帮助用户开启/打开/启用/使用儿童锁功能",
            "parameters": {}
        },
        {
            "name": "child_lock_off",
            "description": "解锁儿童锁，帮助用户解除/停用/去除/关闭/取消儿童锁功能",
            "parameters": {}
        },
        {
            "name": "set_theme_next",
            "description": "切换主题，帮助用户切换/调整/设置/更换或使用指定序号的主题/风格/样式/背景",
            "parameters": {
                "type": "object",
                "properties": {
                    "ordinal": {
                        "type": "string",
                        "description": "要切换的主题序号，格式为‘第 N’，N 的取值范围 1-100，若有相近描述需转化为标准的格式。\n 例如第 1=编号 1、第 2=编号 2、第51=倒数第 "
                                       "1=最后一=最后 1、第 52=倒数第 2 等。"
                    }
                }
            }
        },
        {
            "name": "set_theme_previous",
            "description": "换回上一个主题，帮助用户切回/换回/改为上一个主题/风格/样式/背景",
            "parameters": {}
        },
        {
            "name": "set_taste",
            "description": "选择口感，帮助用户设置/选择/调整烹饪的口感",
            "parameters": {
                "type": "object",
                "properties": {
                    "taste": {
                        "type": "string",
                        "enum": [
                            "脆嫩",
                            "Q 弹",
                            "紧实",
                            "绵软",
                            "软糯",
                            "软烂",
                            "嫩滑",
                            "脆爽",
                            "爽滑",
                            "默认",
                            "焦一点"
                        ],
                        "description": "要设置的口感，取值范围不能超出’enum‘， 但若有相近值可转化为’enum‘中的值。\n 脆爽的相近值有[脆一点、爽脆、脆脆的]；嫩滑的相近值有["
                                       "滑嫩、软滑]；软烂的相近值有[烂一点、老一点、软软、软一点]；软糯的相近值有[糯一点、糯糯、糯叽叽、糯滑、粘糯]；\n 焦一点的相近值有["
                                       "焦一点、焦焦的]；默认的相近值有[推荐]；Q 弹的相近值有[弹韧、Q Q 弹弹、有弹性]；紧实的相近值有[紧致、密实、筋道、有嚼劲、劲道]。"
                    },
                    "food": {
                        "type": "string",
                        "description": "要烹饪的食物名称（非必须），例如猪肉、牛肉、羊肉、包子、红烧肉、烤肠、姜丝牛杂等。"
                    }
                },
                "required": [
                    "taste"
                ]
            }
        },
        {
            "name": "set_foodtype",
            "description": "选择食物，帮助用户设置/选择/调整烹饪的食物品类",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "要烹饪的食物，例如清烹饪韭菜、爆炒肥肠、牛肉、鸡肉等等。"
                    }
                },
                "required": [
                    "food"
                ]
            }
        },
        {
            "name": "set_foodtype_taste",
            "description": "选择食物品类+口感，帮助用户设置/选择/调整烹饪的食物品类和口感",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "要烹饪的食物，例如清烹饪韭菜、爆炒肥肠、牛肉、鸡肉等等。"
                    },
                    "taste": {
                        "type": "string",
                        "enum": [
                            "脆嫩",
                            "Q 弹",
                            "紧实",
                            "绵软",
                            "软糯",
                            "软烂",
                            "嫩滑",
                            "脆爽",
                            "爽滑",
                            "默认",
                            "焦一点"
                        ],
                        "description": "要设置的口感，取值范围不能超出’enum‘， 但若有相近值可转化为’enum‘中的值。\n 脆爽的相近值有[脆一点、爽脆、脆脆的]；嫩滑的相近值有["
                                       "滑嫩、软滑]；软烂的相近值有[烂一点、老一点、软软、软一点]；软糯的相近值有[糯一点、糯糯、糯叽叽、糯滑、粘糯]；\n 焦一点的相近值有["
                                       "焦一点、焦焦的]；默认的相近值有[推荐]；Q 弹的相近值有[弹韧、Q Q 弹弹、有弹性]；紧实的相近值有[紧致、密实、筋道、有嚼劲、劲道]。"
                    }
                },
                "required": [
                    "food",
                    "taste"
                ]
            }
        },
        {
            "name": "set_food_cooking_temp",
            "description": "设置指定食物烹饪温度，帮助用户设置指定食物烹饪/加热的温度值",
            "parameters": {
                "type": "object",
                "properties": {
                    "cooking_temp": {
                        "type": "number",
                        "description": "要设置的烹饪温度，取值范围 20-100，单位为度，例如35、54、60、89 等。"
                    },
                    "food": {
                        "type": "string",
                        "description": "要烹饪的食品名称（非必须），例如红糖糍粑、阿粤广式猪肉肠粉、安井黑椒牛肉酥皮馅饼、奥尔良鸡翅、白米饭等。"
                    }
                },
                "required": [
                    "cooking_temp"
                ]
            }
        },
        {
            "name": "AI_cooking_page_open",
            "description": "帮用户打开智能烹饪页面，智能烹饪页面的相近词有 AI 烹饪、智慧烹饪",
            "parameters": {}
        },
        {
            "name": "DIY_cooking_page_open",
            "description": "帮用户打开自助烹饪页面，自助烹饪页面的相近词有 DIY 烹饪、手动烹饪",
            "parameters": {}
        },
        {
            "name": "heat_cooking_page_open",
            "description": "帮用户打开智能复热页面，智能复热页面的相近词有复热、定温加热、恒温加热、定温烹饪、恒温烹饪、加热、加热页面",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "要烹饪的食品名称（非必须），例如红糖糍粑、阿粤广式猪肉肠粉、安井黑椒牛肉酥皮馅饼、奥尔良鸡翅、白米饭等。"
                    }
                }
            }
        }
    ],
    "en": [
        {
            "name": "voice_cmd_start_cooking",
            "description": "Start cooking, help the user start the microwave cooking process",
            "parameters": {}
        },
        {
            "name": "voice_cmd_pause_cooking",
            "description": "Pause cooking, help the user pause the microwave cooking process",
            "parameters": {}
        },
        {
            "name": "voice_cmd_continue_cooking",
            "description": "Continue cooking, help the user resume the microwave cooking process",
            "parameters": {}
        },
        {
            "name": "voice_cmd_stop_cooking",
            "description": "Stop cooking, help the user stop/end/exit the microwave cooking process",
            "parameters": {}
        },
        {
            "name": "remaining_cooking_time_query",
            "description": "Query remaining cooking time, inform the user of the remaining duration of the current cooking process",
            "parameters": {}
        },
        {
            "name": "cooking_unfreeze",
            "description": "Defrost, help the user set the defrost mode and start the process directly",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "Name of the food to defrost (optional), e.g., Pork, Beef, Lamb, Sausage, Braised Pork, Fried Rice, Dumplings, etc."
                    }
                }
            }
        },
        {
            "name": "set_cooking_temp",
            "description": "Set cooking temperature, help the user set the cooking/heating temperature",
            "parameters": {
                "type": "object",
                "properties": {
                    "cooking_temp": {
                        "type": "number",
                        "description": "The cooking temperature to set, range 20-100, unit: degrees, e.g., 35, 54, 60, 89."
                    }
                },
                "required": [
                    "cooking_temp"
                ]
            }
        },
        {
            "name": "set_firepower_time",
            "description": "Set firepower and time, help the user set the firepower mode and duration for cooking/heating",
            "parameters": {
                "type": "object",
                "properties": {
                    "firepower": {
                        "type": "string",
                        "enum": [
                            "Low",
                            "Medium",
                            "High"
                        ],
                        "description": "The firepower mode to set. Must be one of 'enum'. Similar values can be converted.\n Low similar values: [Low heat, Min heat]; Medium similar values: [Medium heat]; High similar values: [High heat, Max heat]."
                    },
                    "duration": {
                        "type": "number",
                        "description": "The cooking duration to set, unit: seconds (s). Please convert other units to seconds, e.g., 100s, 7 minutes = 420s. Max 40 minutes."
                    }
                },
                "required": [
                    "firepower",
                    "duration"
                ]
            }
        },
        {
            "name": "set_firepower",
            "description": "Set firepower, help the user set the firepower mode for cooking/heating",
            "parameters": {
                "type": "object",
                "properties": {
                    "firepower": {
                        "type": "string",
                        "enum": [
                            "Low",
                            "Medium",
                            "High"
                        ],
                        "description": "The firepower mode to set. Must be one of 'enum'. Similar values can be converted.\n Low similar values: [Low heat, Min heat]; Medium similar values: [Medium heat]; High similar values: [High heat, Max heat]."
                    }
                },
                "required": [
                    "firepower"
                ]
            }
        },
        {
            "name": "set_cooking_time",
            "description": "Set cooking time, help the user set the cooking/heating duration",
            "parameters": {
                "type": "object",
                "properties": {
                    "duration": {
                        "type": "number",
                        "description": "The cooking duration to set, unit: seconds (s). Please convert other units to seconds, e.g., 100s, 7 minutes = 420s."
                    }
                },
                "required": [
                    "duration"
                ]
            }
        },
        {
            "name": "jump_to_page",
            "description": "Open specified page, help the user navigate/switch to a specific page",
            "parameters": {
                "type": "object",
                "properties": {
                    "page_name": {
                        "type": "string",
                        "enum": [
                            "Help Page",
                            "Language Page",
                            "Device Info Page",
                            "Network Page",
                            "Settings Page"
                        ],
                        "description": "The page name to open. Must be one of 'enum'. Similar values can be converted.\n Help Page: [Help, Guide, Manual]; Settings Page: [Settings, System Settings];\n Language Page: [Language Switch, Select Language]; Device Info Page: [Device Details];\n Network Page: [Network, WiFi Settings, Connection]."
                    }
                },
                "required": [
                    "page_name"
                ]
            }
        },
        {
            "name": "back_home_page",
            "description": "Return to Home Page, help the user go back/navigate to the home/main page",
            "parameters": {}
        },
        {
            "name": "volume_up",
            "description": "Increase volume, help the user turn up the volume",
            "parameters": {
                "type": "object",
                "properties": {
                    "volume_value": {
                        "type": "number",
                        "description": "The amount to increase (default 10), range 1-100, e.g., 35% = 35."
                    }
                }
            }
        },
        {
            "name": "volume_down",
            "description": "Decrease volume, help the user turn down the volume",
            "parameters": {
                "type": "object",
                "properties": {
                    "volume_value": {
                        "type": "number",
                        "description": "The amount to decrease (default 10), range 1-100, e.g., 35% = 35."
                    }
                }
            }
        },
        {
            "name": "volume_value",
            "description": "Set volume to target value, help the user set the volume to a specific level",
            "parameters": {
                "type": "object",
                "properties": {
                    "volume_value": {
                        "type": "number",
                        "description": "The target volume level, range 0-100, e.g., 10, 35% = 35, 0."
                    }
                },
                "required": [
                    "volume_value"
                ]
            }
        },
        {
            "name": "volume_max",
            "description": "Max volume, help the user set the volume to maximum",
            "parameters": {}
        },
        {
            "name": "bright_up",
            "description": "Increase brightness, help the user increase screen brightness",
            "parameters": {
                "type": "object",
                "properties": {
                    "bright_value": {
                        "type": "number",
                        "description": "The amount to increase (default 10), range 1-100, e.g., 35% = 35."
                    }
                }
            }
        },
        {
            "name": "bright_down",
            "description": "Decrease brightness, help the user decrease screen brightness",
            "parameters": {
                "type": "object",
                "properties": {
                    "bright_value": {
                        "type": "number",
                        "description": "The amount to decrease (default 10), range 1-100, e.g., 35% = 35."
                    }
                }
            }
        },
        {
            "name": "bright_value",
            "description": "Set brightness to target value, help the user set screen brightness to a specific level",
            "parameters": {
                "type": "object",
                "properties": {
                    "bright_value": {
                        "type": "number",
                        "description": "The target brightness level, range 0-100, e.g., 10, 35% = 35."
                    }
                },
                "required": [
                    "bright_value"
                ]
            }
        },
        {
            "name": "bright_max",
            "description": "Max brightness, help the user set brightness to maximum",
            "parameters": {}
        },
        {
            "name": "bright_min",
            "description": "Min brightness, help the user set brightness to minimum",
            "parameters": {}
        },
        {
            "name": "role_switch",
            "description": "Switch Role, help the user change the virtual assistant role",
            "parameters": {
                "type": "object",
                "properties": {
                    "ordinal": {
                        "type": "string",
                        "description": "The ordinal of the role to switch to, format 'No. N', N range 1-100. Convert descriptions like 'first' to 'No. 1', 'last' to 'No. 51'."
                    }
                }
            }
        },
        {
            "name": "screen_off",
            "description": "Screen Off/Sleep, help the user turn off the screen",
            "parameters": {}
        },
        {
            "name": "screen_off_timeout",
            "description": "Set Screen Timeout, help the user set the time before screen sleep",
            "parameters": {
                "type": "object",
                "properties": {
                    "timeout": {
                        "type": "string",
                        "enum": [
                            "15s",
                            "30s",
                            "1min",
                            "2min",
                            "5min",
                            "10min",
                            "Never"
                        ],
                        "description": "The timeout value. Must be one of 'enum'. Similar values can be converted.\n 15s: [15 seconds]; 1min: [1 minute]; Never: [Always on]."
                    }
                }
            }
        },
        {
            "name": "mute",
            "description": "Mute, help the user enable mute mode",
            "parameters": {}
        },
        {
            "name": "unmute",
            "description": "Unmute, help the user disable mute mode",
            "parameters": {}
        },
        {
            "name": "select_list_id",
            "description": "Select Item, help the user select a recipe/item by ordinal on the current page",
            "parameters": {
                "type": "object",
                "properties": {
                    "ordinal": {
                        "type": "string",
                        "description": "The ordinal to select, format 'No. N', N range 1-100. Convert 'first' to 'No. 1'."
                    }
                },
                "required": [
                    "ordinal"
                ]
            }
        },
        {
            "name": "child_lock_on",
            "description": "Enable Child Lock, help the user turn on the child lock",
            "parameters": {}
        },
        {
            "name": "child_lock_off",
            "description": "Disable Child Lock, help the user turn off the child lock",
            "parameters": {}
        },
        {
            "name": "set_theme_next",
            "description": "Next Theme, help the user switch to the next theme/style",
            "parameters": {
                "type": "object",
                "properties": {
                    "ordinal": {
                        "type": "string",
                        "description": "The ordinal of the theme, format 'No. N', N range 1-100."
                    }
                }
            }
        },
        {
            "name": "set_theme_previous",
            "description": "Previous Theme, help the user switch back to the previous theme",
            "parameters": {}
        },
        {
            "name": "set_taste",
            "description": "Select Taste, help the user set the cooking taste preference",
            "parameters": {
                "type": "object",
                "properties": {
                    "taste": {
                        "type": "string",
                        "enum": [
                            "Crisp",
                            "Chewy",
                            "Firm",
                            "Soft",
                            "Glutinous",
                            "Tender",
                            "Smooth",
                            "Default",
                            "Burnt"
                        ],
                        "description": "The taste preference. Must be one of 'enum'. Similar values can be converted."
                    },
                    "food": {
                        "type": "string",
                        "description": "Name of the food (optional)."
                    }
                },
                "required": [
                    "taste"
                ]
            }
        },
        {
            "name": "set_foodtype",
            "description": "Select Food Type, help the user set the food category for cooking",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "The food to cook, e.g., Beef, Chicken."
                    }
                },
                "required": [
                    "food"
                ]
            }
        },
        {
            "name": "set_foodtype_taste",
            "description": "Select Food Type + Taste, help the user set both food category and taste",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "The food to cook."
                    },
                    "taste": {
                        "type": "string",
                        "enum": [
                            "Crisp",
                            "Chewy",
                            "Firm",
                            "Soft",
                            "Glutinous",
                            "Tender",
                            "Smooth",
                            "Default",
                            "Burnt"
                        ],
                        "description": "The taste preference."
                    }
                },
                "required": [
                    "food",
                    "taste"
                ]
            }
        },
        {
            "name": "set_food_cooking_temp",
            "description": "Set Food Cooking Temp, help the user set cooking temperature for a specific food",
            "parameters": {
                "type": "object",
                "properties": {
                    "cooking_temp": {
                        "type": "number",
                        "description": "The cooking temperature to set, range 20-100."
                    },
                    "food": {
                        "type": "string",
                        "description": "Name of the food."
                    }
                },
                "required": [
                    "cooking_temp"
                ]
            }
        },
        {
            "name": "AI_cooking_page_open",
            "description": "Open AI Cooking Page, help the user open the smart cooking page",
            "parameters": {}
        },
        {
            "name": "DIY_cooking_page_open",
            "description": "Open DIY Cooking Page, help the user open the manual/DIY cooking page",
            "parameters": {}
        },
        {
            "name": "heat_cooking_page_open",
            "description": "Open Reheat Page, help the user open the reheating/warm-up page",
            "parameters": {
                "type": "object",
                "properties": {
                    "food": {
                        "type": "string",
                        "description": "Name of the food (optional)."
                    }
                }
            }
        }
    ]
}
