"""Read, write or clear VS Code's GitHub sign-in secret in a VS Code state database.

Usage: vscode_secret.py get|set|clear|has <state.vscdb> [<file>]
The value is kept exactly as VS Code stored it (already encrypted by VS Code).
Exit code 3 from "get" or "has" means the database has no GitHub session.
"""
import sqlite3
import sys

KEY = 'secret://{"extensionId":"vscode.github-authentication","key":"github.auth"}'

action, db = sys.argv[1], sys.argv[2]
con = sqlite3.connect(db)
if action == 'get':
    row = con.execute('SELECT value FROM ItemTable WHERE key = ?', (KEY,)).fetchone()
    if row is None:
        sys.exit(3)
    with open(sys.argv[3], 'w', encoding='utf-8') as f:
        f.write(row[0])
elif action == 'set':
    with open(sys.argv[3], encoding='utf-8') as f:
        value = f.read()
    con.execute('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)', (KEY, value))
elif action == 'clear':
    con.execute('DELETE FROM ItemTable WHERE key = ?', (KEY,))
elif action == 'has':
    if con.execute('SELECT 1 FROM ItemTable WHERE key = ?', (KEY,)).fetchone() is None:
        sys.exit(3)
else:
    sys.exit('unknown action: ' + action)
con.commit()
con.close()
