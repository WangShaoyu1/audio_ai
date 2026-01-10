import requests
import json
import time
import os

BASE_URL = "http://localhost:8000/api/v1"
TEST_USER = "test_user_001"
TEST_PASSWORD = "password123"

def log(message, status="INFO"):
    print(f"[{status}] {message}")

def test_login():
    log("Testing Login...")
    url = f"{BASE_URL}/auth/login"
    # Backend expects 'phone' and 'code' (or password if modified), checking error msg: "missing... phone"
    # Assuming the backend was updated to use phone login as per PRD v2.1
    payload = {"phone": "13800138000", "code": "123456"} 
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            token = response.json().get("access_token")
            log("Login Successful", "PASS")
            return token
        else:
            log(f"Login Failed: {response.text}", "FAIL")
            return None
    except Exception as e:
        log(f"Login Exception: {e}", "FAIL")
        return None

def test_sessions(token):
    log("Testing Session Management...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create Session (Implicitly via Chat or Explicitly if API exists)
    # Assuming explicit creation or listing first
    
    # 2. List Sessions
    log("  - List Sessions")
    try:
        res = requests.get(f"{BASE_URL}/sessions", headers=headers)
        if res.status_code == 200:
            sessions = res.json()
            log(f"    Got {len(sessions)} sessions", "PASS")
        else:
            log(f"    List Sessions Failed: {res.text}", "FAIL")
            return None
    except Exception as e:
        log(f"    List Sessions Exception: {e}", "FAIL")
        return None

    # 3. Create a new session via chat (if no explicit create endpoint)
    # Or use the first existing session
    session_id = None
    if sessions:
        session_id = sessions[0]['id']
    else:
        # Try to create one via chat
        pass 

    return session_id

def test_chat(token, session_id):
    log("Testing Chat Interface...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Non-streaming Chat
    log("  - Non-streaming Chat")
    payload = {
        "session_id": session_id,
        "query": "你好，测试一下",
        "stream": False
    }
    try:
        res = requests.post(f"{BASE_URL}/chat/completions", json=payload, headers=headers)
        if res.status_code == 200:
            data = res.json()
            if "data" in data and "content" in data["data"]:
                log("    Chat Response Received", "PASS")
            else:
                log(f"    Chat Response Format Error: {data}", "FAIL")
        else:
            log(f"    Chat Request Failed: {res.text}", "FAIL")
    except Exception as e:
        log(f"    Chat Exception: {e}", "FAIL")

    # 2. Streaming Chat
    log("  - Streaming Chat")
    payload["stream"] = True
    try:
        res = requests.post(f"{BASE_URL}/chat/completions", json=payload, headers=headers, stream=True)
        if res.status_code == 200:
            chunk_count = 0
            for line in res.iter_lines():
                if line:
                    chunk_count += 1
            if chunk_count > 0:
                log(f"    Streaming Received {chunk_count} chunks", "PASS")
            else:
                log("    Streaming Received No Data", "FAIL")
        else:
            log(f"    Streaming Request Failed: {res.status_code}", "FAIL")
    except Exception as e:
        log(f"    Streaming Exception: {e}", "FAIL")

def test_history(token, session_id):
    log("Testing History Interface...")
    headers = {"Authorization": f"Bearer {token}"}
    if not session_id:
        log("  Skipping History Test (No Session ID)", "WARN")
        return

    try:
        res = requests.get(f"{BASE_URL}/sessions/{session_id}/history", headers=headers)
        if res.status_code == 200:
            history = res.json()
            if isinstance(history, list):
                log(f"    History Retrieved ({len(history)} messages)", "PASS")
            else:
                log(f"    History Format Error: {history}", "FAIL")
        else:
            log(f"    History Request Failed: {res.text}", "FAIL")
    except Exception as e:
        log(f"    History Exception: {e}", "FAIL")

def test_knowledge_base(token):
    log("Testing Knowledge Base Interface...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. List Documents (Corrected URL: /admin/documents)
    log("  - List Documents")
    try:
        res = requests.get(f"{BASE_URL}/admin/documents", headers=headers)
        if res.status_code == 200:
            docs = res.json()
            log(f"    Got {len(docs)} documents", "PASS")
        else:
            log(f"    List Documents Failed: {res.text}", "FAIL")
    except Exception as e:
        log(f"    List Documents Exception: {e}", "FAIL")

    # 2. Upload Document (Corrected URL: /admin/documents/upload)
    with open("test_doc.txt", "w") as f:
        f.write("This is a test document for knowledge base.")
    
    log("  - Upload Document")
    try:
        files = {'file': ('test_doc.txt', open('test_doc.txt', 'rb'), 'text/plain')}
        res = requests.post(f"{BASE_URL}/admin/documents/upload", headers=headers, files=files)
        if res.status_code == 200:
            log("    Upload Successful", "PASS")
        else:
            log(f"    Upload Failed: {res.text}", "FAIL")
    except Exception as e:
        log(f"    Upload Exception: {e}", "FAIL")
    finally:
        if os.path.exists("test_doc.txt"):
            os.remove("test_doc.txt")

def run_tests():
    log("Starting Comprehensive Interface Tests...")
    
    # 1. Login
    token = test_login()
    if not token:
        log("Aborting tests due to login failure", "CRITICAL")
        return

    # 2. Sessions
    session_id = test_sessions(token)

    # 3. Chat
    if session_id:
        test_chat(token, session_id)
        test_history(token, session_id)
    
    # 4. Knowledge Base
    test_knowledge_base(token)

    log("All Tests Completed.")

if __name__ == "__main__":
    run_tests()
