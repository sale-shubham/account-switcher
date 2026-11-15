#!/usr/bin/env bash
# Stop hook: syntax/type gate for the switcher's code. There is no test suite
# (.claude/RULES.md section 10), so this is the automatic check: when a *.ps1 or *.py
# in the project root or lib/, or a file in web/src, changed since the last passing run,
# parse the scripts with the Windows PowerShell 5.1 parser and Python's ast,
# typecheck web/ with tsc (never a build), and block the turn from ending (exit 2)
# until everything passes.
#
# Fires once per stop-cluster: if a Stop hook already blocked, let the stop
# through rather than loop.

input=$(cat)
dir="${CLAUDE_PROJECT_DIR:-.}"
cd "$dir" || exit 0

if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

stamp=".claude/.quality-stamp"
if [ -f "$stamp" ]; then
  scripts_changed=$(find . lib -maxdepth 1 \( -name '*.ps1' -o -name '*.py' \) -newer "$stamp" 2>/dev/null)
  web_changed=$(find web/src web/vite.config.ts web/tsconfig.json -newer "$stamp" 2>/dev/null)
else
  scripts_changed=1
  web_changed=1
fi
[ -z "$scripts_changed" ] && [ -z "$web_changed" ] && exit 0

out=$(powershell.exe -NoProfile -NonInteractive -Command '
  foreach ($f in @(Get-ChildItem -Filter *.ps1) + @(Get-ChildItem lib -Filter *.ps1 -ErrorAction SilentlyContinue)) {
    $errors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$null, [ref]$errors)
    foreach ($e in $errors) { $f.Name + ":" + $e.Extent.StartLineNumber + ": " + $e.Message }
  }' 2>&1)
for f in *.py lib/*.py; do
  [ -f "$f" ] || continue
  pyout=$(python -I -c 'import ast, sys; ast.parse(open(sys.argv[1], encoding="utf-8").read(), sys.argv[1])' "$f" 2>&1)
  [ -n "$pyout" ] && out="${out:+$out
}$pyout"
done
# Typecheck only (tsc --noEmit). Skipped until npm install has run in web/.
if [ -n "$web_changed" ] && [ -d web/node_modules ]; then
  tsout=$(cd web && npx --no-install tsc --noEmit 2>&1) || out="${out:+$out
}$tsout"
fi

if [ -n "$out" ]; then
  {
    echo "Quality gate (.claude/hooks/quality-gate.sh): the switcher code does not parse or typecheck."
    echo "Fix every problem below, then stop again:"
    printf '%s\n' "$out" | tail -40
  } >&2
  exit 2
fi

touch "$stamp"
exit 0
