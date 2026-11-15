"""Read, replace or remove the signed-in account ("oauthAccount") in Claude Code's .claude.json.

Usage: claude_account.py show|get|set|clear <.claude.json> [<file>]
  show   print who is signed in (email, name, organization, ids) as one line of JSON
  get    write the whole oauthAccount object to <file>
  set    replace oauthAccount with the object in <file>
  clear  remove oauthAccount
Exit code 3 from "show" or "get" means no account is signed in. Only "oauthAccount" is touched;
the rest of the file (settings, projects, history) is written back unchanged. The tokens are not in
this file and never pass through here.
"""
import json
import os
import sys

KEY = 'oauthAccount'
SHOWN = ('emailAddress', 'displayName', 'organizationName', 'accountUuid', 'organizationUuid')

action, path = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding='utf-8') as f:
        state = json.load(f)
except FileNotFoundError:
    state = {}

if action in ('show', 'get'):
    account = state.get(KEY)
    if not account:
        sys.exit(3)
    if action == 'show':
        # ASCII escapes: Windows PowerShell 5.1 would garble non-ASCII names read from stdout.
        print(json.dumps({k: account.get(k) for k in SHOWN}))
    else:
        with open(sys.argv[3], 'w', encoding='utf-8') as f:
            json.dump(account, f, indent=2)
    sys.exit(0)

if action == 'set':
    with open(sys.argv[3], encoding='utf-8') as f:
        state[KEY] = json.load(f)
elif action == 'clear':
    if KEY not in state:
        sys.exit(0)
    del state[KEY]
else:
    sys.exit('unknown action: ' + action)

# Write a temporary file next to it, then swap: a failure halfway never leaves a cut-off .claude.json.
temp = path + '.account-switch.tmp'
with open(temp, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(state, f, indent=2, ensure_ascii=False)
os.replace(temp, path)
