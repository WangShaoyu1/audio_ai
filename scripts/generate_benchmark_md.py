
import pandas as pd
import glob
import os

# Find latest results
list_of_files = glob.glob('tests/*/benchmark_results.csv') 
latest_file = max(list_of_files, key=os.path.getctime)
print(f"Reading {latest_file}")

df = pd.read_csv(latest_file)

# Summary Table
summary = df.groupby(['provider', 'category'])[['ttft_ms', 'total_ms', 'intent_ms']].mean().round(0).astype(int).reset_index()
print("\n### 7.1 总体性能摘要 (Average Latency)")
print("| Provider | Category | Intent Latency (ms) | TTFT (ms) | Total Latency (ms) |")
print("| :--- | :--- | :--- | :--- | :--- |")
for _, row in summary.iterrows():
    print(f"| {row['provider']} | {row['category']} | {row['intent_ms']} | {row['ttft_ms']} | {row['total_ms']} |")

# Connectivity/Status
print("\n### 7.2 连通性与错误率")
total = len(df)
success = len(df[df['full_response'].notna() & (df['full_response'] != "")])
print(f"*   **Total Requests**: {total}")
print(f"*   **Success Rate**: {success/total*100:.1f}%")

# Detailed observations
print("\n### 7.3 详细观察")
print("*   **Intent Classification**: Average latency around " + str(int(df['intent_ms'].mean())) + "ms.")
print("*   **Instruction**: ...")
