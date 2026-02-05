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
    # Backend expects 'phone'
    payload = {"phone": "13800138000"} 
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
    
    # 1. List Sessions
    log("  - List Sessions")
    sessions = []
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

    # 2. Create Session (if needed or just to test the endpoint)
    session_id = None
    if not sessions:
        log("  - Creating New Session")
        try:
            res = requests.post(f"{BASE_URL}/sessions", headers=headers)
            if res.status_code == 200:
                new_session = res.json()
                session_id = new_session['id']
                log(f"    Session Created: {session_id}", "PASS")
            else:
                log(f"    Create Session Failed: {res.text}", "FAIL")
        except Exception as e:
            log(f"    Create Session Exception: {e}", "FAIL")
    else:
        session_id = sessions[0]['id']
        log(f"    Using existing session: {session_id}", "INFO")

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
        with open('test_doc.txt', 'rb') as f_upload:
            files = {'file': ('test_doc.txt', f_upload, 'text/plain')}
            res = requests.post(f"{BASE_URL}/admin/documents/upload", headers=headers, files=files)
            if res.status_code == 200:
                log("    Upload Successful", "PASS")
            else:
                log(f"    Upload Failed: {res.text}", "FAIL")
    except Exception as e:
        log(f"    Upload Exception: {e}", "FAIL")
    finally:
        if os.path.exists("test_doc.txt"):
            try:
                os.remove("test_doc.txt")
            except Exception as e:
                log(f"    Cleanup Warning: Could not remove test_doc.txt: {e}", "WARN")

def test_session_config(token, session_id):
    log("Testing Session Config Interface...")
    headers = {"Authorization": f"Bearer {token}"}
    if not session_id:
        log("  Skipping Config Test (No Session ID)", "WARN")
        return

    # Update Config with language
    log("  - Update Session Config (language=en)")
    config = {"language": "en"}
    try:
        res = requests.put(f"{BASE_URL}/sessions/{session_id}/config", json=config, headers=headers)
        if res.status_code == 200:
            log("    Update Config Successful", "PASS")
        else:
            log(f"    Update Config Failed: {res.text}", "FAIL")
    except Exception as e:
        log(f"    Update Config Exception: {e}", "FAIL")

    # Get Config and verify language
    log("  - Get Session Config")
    try:
        res = requests.get(f"{BASE_URL}/sessions/{session_id}/config", headers=headers)
        if res.status_code == 200:
            data = res.json()
            if data.get("language") == "en":
                log("    Get Config Verified (language=en)", "PASS")
            else:
                log(f"    Get Config Verification Failed: language={data.get('language')}", "FAIL")
        else:
            log(f"    Get Config Failed: {res.text}", "FAIL")
    except Exception as e:
        log(f"    Get Config Exception: {e}", "FAIL")

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
        test_session_config(token, session_id)
        test_chat(token, session_id)
        test_history(token, session_id)
    
    # 4. Knowledge Base
    test_knowledge_base(token)

    log("All Tests Completed.")

if __name__ == "__main__":
    run_tests()
