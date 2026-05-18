import json
import urllib.request

url = 'http://127.0.0.1:8010/chat'
data = {
    'session_id': 'test-session',
    'student_name': 'Test',
    'student_class': 7,
    'language': 'English',
    'message': 'What is density?'
}
req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as r:
        print('STATUS', r.status)
        print(r.read().decode('utf-8'))
except Exception as e:
    print('ERROR', type(e).__name__, e)
    if hasattr(e, 'read'):
        print('BODY', e.read().decode('utf-8', errors='ignore'))
