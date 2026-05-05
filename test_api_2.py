import json, urllib.request, urllib.error

url = 'http://localhost:8001/chat'
data = {
    'session_id':'test-12345',
    'student_name':'Rahul',
    'student_class':7,
    'language':'English',
    'message':'How do I solve 2x + 5 = 11?'
}

req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})

try:
    res = urllib.request.urlopen(req)
    print("SUCCESS:")
    print(res.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print("ERROR READ:", e.read().decode())
except Exception as e:
    print("OTHER ERROR:", str(e))
