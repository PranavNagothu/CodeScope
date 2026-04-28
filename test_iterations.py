#!/usr/bin/env python3
"""
CodeScope — End-to-end iteration test
Tests: analyze → fix → re-analyze → check score progression
"""
import json, urllib.request, urllib.error, sys, time

BASE = "http://localhost:4000/graphql"
HEADERS = {"Content-Type": "application/json"}

BAD_PYTHON = """import os
import sqlite3

PASSWORD = "admin123"
SECRET_KEY = "hardcoded-secret"

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchall()

def delete_user(user_id):
    os.system("rm -rf /users/" + user_id)

def load_data(filename):
    import pickle
    with open(filename, "rb") as f:
        return pickle.load(f)
"""

def gql(query, variables=None, token=None):
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    hdrs = {**HEADERS}
    if token: hdrs["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE, data=payload, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=200) as r:
            data = json.loads(r.read())
            if "errors" in data:
                raise Exception(data["errors"][0]["message"])
            return data["data"]
    except urllib.error.HTTPError as e:
        raise Exception(f"HTTP {e.code}: {e.read().decode()}")

def print_result(label, score, issues):
    sev = {}
    for i in issues: sev[i['severity']] = sev.get(i['severity'], 0) + 1
    bar = "█" * (score // 5) + "░" * (20 - score // 5)
    print(f"\n{'='*55}")
    print(f"  {label}")
    print(f"  Score: {score}/100  [{bar}]")
    print(f"  Issues: {dict(sev)}")
    print(f"{'='*55}")

# ── Login ─────────────────────────────────────────────────────
print("\n🔐 Logging in...")
try:
    auth = gql('mutation { login(email:"e2etest@codescope.dev", password:"test1234") { token } }')
    token = auth["login"]["token"]
    print("  ✅ Token obtained")
except Exception as e:
    print(f"  ❌ Login failed: {e}")
    sys.exit(1)

# ── CYCLE 1: Analyze original bad code ─────────────────────────
print("\n📊 CYCLE 1 — Analyzing original bad Python code...")
t0 = time.time()
try:
    r = gql("""
        mutation($code: String!) {
            analyzeCode(title:"Iteration Test", language:"python", sourceCode:$code) {
                id metrics { overallScore } issues { severity type message }
            }
        }
    """, {"code": BAD_PYTHON}, token)
    a1 = r["analyzeCode"]
    score1 = a1["metrics"]["overallScore"]
    print(f"  ⏱  {time.time()-t0:.1f}s")
    print_result("ORIGINAL CODE", score1, a1["issues"])

    if score1 >= 80:
        print("  ℹ️  Score already high — no fix needed")
        sys.exit(0)

except Exception as e:
    print(f"  ❌ Analysis failed: {e}")
    sys.exit(1)

# ── CYCLE 1: Fix ───────────────────────────────────────────────
print("\n🔧 CYCLE 1 — Generating fix...")
t0 = time.time()
try:
    r2 = gql("""
        mutation($id: ID!) {
            fixCode(analysisId: $id) { fixedCode summary processingTimeMs }
        }
    """, {"id": a1["id"]}, token)
    fix1 = r2["fixCode"]
    print(f"  ⏱  {fix1['processingTimeMs']}ms")
    print(f"  📝 Summary: {fix1['summary']}")
    print(f"  📄 Fixed code preview: {fix1['fixedCode'][:200].strip()}...")
except Exception as e:
    print(f"  ❌ Fix failed: {e}")
    sys.exit(1)

# ── CYCLE 2: Analyze fixed code ────────────────────────────────
print("\n📊 CYCLE 2 — Re-analyzing fixed code...")
t0 = time.time()
try:
    r3 = gql("""
        mutation($code: String!) {
            analyzeCode(title:"Iteration Test (Fixed)", language:"python", sourceCode:$code) {
                id metrics { overallScore } issues { severity type message }
            }
        }
    """, {"code": fix1["fixedCode"]}, token)
    a2 = r3["analyzeCode"]
    score2 = a2["metrics"]["overallScore"]
    print(f"  ⏱  {time.time()-t0:.1f}s")
    print_result("AFTER FIX 1", score2, a2["issues"])
    improvement = score2 - score1
    print(f"  📈 Improvement: {score1} → {score2} ({'+' if improvement>=0 else ''}{improvement} pts)")

    if score2 >= 80:
        print("\n  🎉 Score ≥ 80 — Fix was successful in ONE pass! No further iterations needed.")
        sys.exit(0)
except Exception as e:
    print(f"  ❌ Re-analysis failed: {e}")
    sys.exit(1)

# ── CYCLE 2: Fix again only if still < 80 ─────────────────────
print(f"\n⚠️  Score still {score2}/100 (< 80). Running second fix pass...")
t0 = time.time()
try:
    r4 = gql("""
        mutation($id: ID!) {
            fixCode(analysisId: $id) { fixedCode summary }
        }
    """, {"id": a2["id"]}, token)
    fix2 = r4["fixCode"]

    r5 = gql("""
        mutation($code: String!) {
            analyzeCode(title:"Iteration Test (Fix 2)", language:"python", sourceCode:$code) {
                metrics { overallScore } issues { severity type }
            }
        }
    """, {"code": fix2["fixedCode"]}, token)
    a3 = r5["analyzeCode"]
    score3 = a3["metrics"]["overallScore"]
    print(f"  ⏱  {time.time()-t0:.1f}s")
    print_result("AFTER FIX 2", score3, a3["issues"])
    print(f"  📈 Total: {score1} → {score2} → {score3}")
except Exception as e:
    print(f"  ❌ Second cycle failed: {e}")

print("\n✅ Test complete.")
