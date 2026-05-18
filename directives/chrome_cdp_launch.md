# Chrome CDP Launch Protocol — MANDATORY

## The Command (USE THIS EVERY TIME)
```bash
# 1. Kill Chrome fully
killall -9 "Google Chrome" 2>/dev/null
sleep 2
rm -f ~/Library/Application\ Support/Google/Chrome/SingletonLock

# 2. Clone real Chrome profile (preserves all logins, bookmarks, extensions)
DEBUG_DIR="/Volumes/WORK 2TB/WORK 2026/CASINO/.tmp/chrome-debug-profile"
if [ ! -d "$DEBUG_DIR/Default" ]; then
  echo "Cloning Chrome profile..."
  cp -R ~/Library/Application\ Support/Google/Chrome/ "$DEBUG_DIR/"
  rm -f "$DEBUG_DIR/SingletonLock"
fi

# 3. Launch with BOTH flags (BOTH ARE REQUIRED as of Chrome 148+)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$DEBUG_DIR" \
  --no-first-run \
  "http://localhost:8888" \
  > /dev/null 2>&1 &

# 4. Wait for startup
sleep 8

# 5. Verify
curl -s http://localhost:9222/json/version | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'CDP: {d[\"Browser\"]}')"
```

## Profile Cloning
The debug profile is cloned from your real Chrome profile ONCE. After that it persists in `.tmp/chrome-debug-profile/`. If you need to refresh it (new extensions, cleared cookies), delete the directory and it will re-clone on next launch.

## Why This Breaks (History)
- **Chrome 148+ changed behavior**: `--remote-debugging-port` alone no longer works. Chrome now REQUIRES `--user-data-dir` to be set to a non-default directory for CDP to bind.
- **SingletonLock**: If Chrome crashes or is force-killed, a stale `SingletonLock` file blocks the next launch. Always remove it before launching.
- **`open -a` breaks it**: NEVER use `open -a "Google Chrome"` — it ignores CLI flags and opens Chrome without CDP.
- **Existing session blocks**: If Chrome is already running without the flag, the flag can't be added. Must fully kill Chrome first.

## Verification
```bash
nc -z localhost 9222 && echo "CDP OK" || echo "CDP DEAD"
curl -s http://localhost:9222/json | python3 -c "import sys,json;[print(t['url'][:80]) for t in json.load(sys.stdin)]"
```

## FanDuel Login Note
The `--user-data-dir` creates a separate Chrome profile. FanDuel login cookies are NOT shared from the default profile. The user will need to log in to FanDuel once in this debug profile. After that, cookies persist in the debug profile directory.
