import os
import sys
import subprocess
import argparse
import time

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
    # 优化：直接在start命令中执行，确保窗口保留并显示日志
    redis_cmd = f'start "Redis服务窗口" /D "{REDIS_ROOT}" cmd /k "redis-server.exe redis.windows.conf"'
    try:
        subprocess.Popen(redis_cmd, shell=True)
        print(f"✅ Redis启动命令已触发（目录：{REDIS_ROOT}）")
    except Exception as e:
        print(f"❌ Redis启动失败：{str(e)}")
        sys.exit(1)

    # 2. 启动PostgreSQL（新建独立窗口，不阻塞当前Python进程）
    # 优化：使用pg_ctl start -l logfile 方式或直接前台运行以显示日志
    # 这里使用前台运行模式，以便在窗口中看到日志
    pg_cmd = f'start "PostgreSQL服务窗口" /D "{PG_BIN_PATH}" cmd /k "pg_ctl start -D \"{PG_DATA_PATH}\" && echo. && echo 【PG服务已启动】请勿关闭此窗口 && echo 如需验证，请另开cmd输入: netstat -an | findstr 5432"'
    try:
        subprocess.Popen(pg_cmd, shell=True)
        print(f"✅ PostgreSQL启动命令已触发（bin目录：{PG_BIN_PATH}）")
    except Exception as e:
        print(f"❌ PostgreSQL启动失败：{str(e)}")
        sys.exit(1)

    print("\n" + "="*50)
    print("【服务启动完成】")
    print("请检查弹出的两个窗口是否有报错信息。")
    print("验证方法：")
    print("1. 打开新的CMD窗口")
    print("2. 输入: netstat -an | findstr 6379  (验证Redis)")
    print("3. 输入: netstat -an | findstr 5432  (验证PostgreSQL)")
    print("注意：浏览器直接访问 localhost:6379/5432 会报错，这是正常的！")
    print("="*50)


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
            # 如果Redis没启动，shutdown会报错，这是正常的
            if "No connection" in error_msg or "refused" in error_msg:
                 print("⚠️ Redis似乎未启动，无需关闭。")
            else:
                print(f"⚠️ Redis关闭提示：{error_msg}")
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
            if "Is server running" in error_msg:
                print("⚠️ PostgreSQL似乎未启动，无需关闭。")
            else:
                print(f"⚠️ PostgreSQL关闭提示：{error_msg}")
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
