# Cumulus Bubble — floating task bubble for macOS

A small circle that floats on top of every app on your Mac. Click it to
pop open the full Cumulus task app in a small window; click again (or
click the bubble) to close it. Drag the bubble anywhere. It automatically
hides itself whenever a lockdown/testing app (Bluebook, Respondus, etc.)
is running.

**Important:** this is a separate app from the Chrome extension you
installed earlier. It has its own task list — they don't sync. Easiest
is to just pick one as your main way of using Cumulus (the bubble works
everywhere, not only in new browser tabs, so that's probably the better
default going forward).

## One-time setup

1. **Check you have the Swift compiler.** Open Terminal and run:
   ```
   xcode-select -p
   ```
   If that prints a path, you're set. If it errors, run:
   ```
   xcode-select --install
   ```
   and click through the installer (this installs Apple's free Command
   Line Tools — no full Xcode needed, takes a few minutes).

2. **Build it.** In Terminal:
   ```
   cd path/to/bubble-app
   chmod +x build.sh run.sh
   ./build.sh
   ```
   This compiles `main.swift` into an app called `CumulusBubble` sitting
   right next to it.

3. **Run it.**
   ```
   ./run.sh
   ```
   You should see a small dark circle with a cloud on it appear in the
   top-right corner of your screen.

## Using it

- **Click** the bubble → the full Cumulus app opens in a small window
  right below it.
- **Click again** (either the bubble or click it while open) → closes
  with a little fade.
- **Drag** the bubble anywhere on screen — it remembers wherever you
  drop it for that session.
- **Right-click** the bubble → **Quit Cumulus Bubble** to shut it down
  completely.
- It stays up across virtual desktops/Spaces so you don't lose it when
  you swipe between apps.

## The lockdown-app watcher

Every 3 seconds it checks the names of your running apps against a
list of known testing/lockdown software. If it finds a match, the
bubble (and popup, if open) disappear immediately and stay hidden
until that app quits.

Current watchlist (edit the `lockdownKeywords` array near the top of
`main.swift` and re-run `./build.sh` to add more):
- Bluebook
- Respondus LockDown Browser
- Honorlock
- Proctorio / ProctorU
- Examity
- ExamSoft
- Safe Exam Browser
- SecureTest

If your school uses something else, send me the app's name and I can
add it — or just add a lowercase snippet of its name to that list
yourself.

## Auto-start when you log in (optional)

If you want the bubble running automatically every time you log into
your Mac, create a file at
`~/Library/LaunchAgents/com.cumulus.bubble.plist` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.cumulus.bubble</string>
  <key>ProgramArguments</key>
  <array>
    <string>/full/path/to/bubble-app/run.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
```

Replace `/full/path/to/bubble-app/run.sh` with the real path (run `pwd`
in the bubble-app folder to get it). Then load it with:
```
launchctl load ~/Library/LaunchAgents/com.cumulus.bubble.plist
```
To stop it auto-starting later: `launchctl unload` that same file.

## Where your data lives

`~/Library/Application Support/CumulusBubble/data.json` — plain JSON,
easy to peek at or back up by hand if you're ever curious.

## License

GPLv3 — see the `LICENSE` file. Anyone can use, run, and modify this
code, but if they distribute a modified version, it has to stay open
source under the same license too.

## Known limitations

- Separate task data from the Chrome extension (explained above).
- The watchlist is name-based — it can't detect a lockdown tool it
  doesn't know the name of. It's a helpful backup, not a guarantee.
- Positioning assumes your main display; with multiple monitors the
  bubble always starts on the primary one.
- This is unsigned code compiled on your own machine — totally normal
  for a personal tool like this, but if macOS ever throws a Gatekeeper
  warning, right-click `CumulusBubble` → **Open** once to clear it.
