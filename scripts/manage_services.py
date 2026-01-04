import os
import sys
import subprocess
import argparse

# ====================== 核心配置项（仅需修改此处，与你的路径匹配） ======================
# Redis安装根目录（无需修改，已适配你的路径）
REDIS_ROOT = r"F:\programe_install\Redis"
# PostgreSQL安装根目录（无需修改）
PG_ROOT = r"F:\programe_install\PostgreSQL"
# =======================================================================================

# 拼接PG核心路径（直接指向根目录下的bin和data，不依赖版本号子目录）
PG_BIN_PATH = os.path.join(PG_ROOT, "bin")
PG_DATA_PATH = os.path.join(PG_ROOT, "data")
# Redis核心文件路径
REDIS_SERVER_EXE = os.path.join(REDIS_ROOT, "redis-server.exe")
REDIS_CLI_EXE = os.path.join(REDIS_ROOT, "redis-cli.exe")
REDIS_CONF = os.path.join(REDIS_ROOT, "redis.windows.conf")
# PG核心工具路径
PG_CTL_EXE = os.path.join(PG_BIN_PATH, "pg_ctl.exe")


def check_files_exists():
    """前置校验：检查Redis和PG的核心文件/目录是否存在"""
    # 校验Redis文件
    redis_check_items = [
        (REDIS_SERVER_EXE, "Redis服务端程序（redis-server.exe）"),
        (REDIS_CLI_EXE, "Redis客户端程序（redis-cli.exe，用于关闭服务）"),
        (REDIS_CONF, "Redis配置文件（redis.windows.conf）")
    ]
    for file_path, desc in redis_check_items:
        if not os.path.exists(file_path):
            print(f"【错误】缺失{desc}，路径：{file_path}")
            sys.exit(1)

    # 校验PG文件/目录
    pg_check_items = [
        (PG_CTL_EXE, "PG核心工具（pg_ctl.exe）"),
        (PG_DATA_PATH, "PG数据目录（data）")
    ]
    for path, desc in pg_check_items:
        if not os.path.exists(path):
            print(f"【错误】缺失{desc}，路径：{path}")
            print(f"       请检查PG_ROOT（当前设置：{PG_ROOT}）是否正确")
            sys.exit(1)

    print("【成功】所有核心文件/目录校验通过！")


def start_services():
    """同时启动Redis和PostgreSQL服务（独立窗口运行，手动模式）"""
    print("【提示】正在同时启动Redis和PostgreSQL服务...")
    print("【注意】启动后会生成2个独立命令行窗口，请勿关闭（关闭则对应服务停止）")

    # 1. 启动Redis（新建独立窗口，不阻塞当前Python进程）
    # cmd /k：执行命令后保持窗口打开；start：新建窗口
    redis_cmd = f'cmd /k "start \"Redis服务窗口\" cd /d \"{REDIS_ROOT}\" && redis-server.exe \"{REDIS_CONF}\""'
    try:
        subprocess.Popen(redis_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"✅ Redis启动命令已执行（目录：{REDIS_ROOT}）")
    except Exception as e:
        print(f"❌ Redis启动失败：{str(e)}")
        sys.exit(1)

    # 2. 启动PostgreSQL（新建独立窗口，不阻塞当前Python进程）
    pg_cmd = f'cmd /k "start \"PostgreSQL服务窗口\" cd /d \"{PG_BIN_PATH}\" && pg_ctl start -D \"{PG_DATA_PATH}\" && echo 【PG提示】启动成功，此窗口请勿关闭 && pause > nul"'
    try:
        subprocess.Popen(pg_cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print(f"✅ PostgreSQL启动命令已执行（bin目录：{PG_BIN_PATH}，数据目录：{PG_DATA_PATH}）")
    except Exception as e:
        print(f"❌ PostgreSQL启动失败：{str(e)}")
        sys.exit(1)

    print("【完成】Redis和PostgreSQL均已触发启动，请查看弹出的独立服务窗口！")


def stop_services():
    """同时优雅关闭Redis和PostgreSQL服务（自动保存数据）"""
    print("【提示】正在同时优雅关闭Redis和PostgreSQL服务...")
    print("【注意】会等待事务完成，自动保存数据，请勿中断")

    # 1. 优雅关闭Redis（触发RDB持久化，保存dump.rdb）
    try:
        # 切换到Redis目录执行关闭命令
        os.chdir(REDIS_ROOT)
        result = subprocess.run(
            [REDIS_CLI_EXE, "shutdown"],
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="gbk",  # Windows终端默认编码
            errors="ignore"  # 忽略编码错误，防止崩溃
        )
        if result.returncode == 0:
            print("✅ Redis服务已优雅关闭，数据已保存！")
        else:
            error_msg = result.stderr.strip()
            print(f"⚠️ Redis关闭失败（可能未启动）：{error_msg if error_msg else '未知错误'}")
    except Exception as e:
        print(f"❌ Redis关闭异常：{str(e)}")

    # 2. 优雅关闭PostgreSQL（-m fast：等待当前事务完成，快速安全关闭）
    try:
        # 切换到PG bin目录执行关闭命令
        os.chdir(PG_BIN_PATH)
        result = subprocess.run(
            [PG_CTL_EXE, "stop", "-D", PG_DATA_PATH, "-m", "fast"],
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="gbk",
            errors="ignore"
        )
        if result.returncode == 0:
            print("✅ PostgreSQL服务已优雅关闭！")
        else:
            error_msg = result.stderr.strip()
            print(f"⚠️ PostgreSQL关闭失败（可能未启动）：{error_msg if error_msg else '未知错误'}")
    except Exception as e:
        print(f"❌ PostgreSQL关闭异常：{str(e)}")

    print("【完成】Redis和PostgreSQL关闭操作执行完毕！")


def main():
    # 1. 解析命令行参数
    parser = argparse.ArgumentParser(description="Redis + PostgreSQL 服务管理工具（支持start/stop参数）")
    parser.add_argument("operation", type=str, choices=["start", "stop"], help="操作类型：start（同时启动）/ stop（同时关闭）")
    args = parser.parse_args()

    # 2. 前置文件校验
    check_files_exists()

    # 3. 根据参数执行对应操作
    if args.operation == "start":
        start_services()
    elif args.operation == "stop":
        stop_services()


if __name__ == "__main__":
    main()
