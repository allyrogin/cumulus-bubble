# Cumulus Bubble

A floating task bubble for macOS. A small cloud icon sits on top of every
app on your screen — click it to open a full task manager in a compact
window, click again to close it. Tasks are organized into visual "clouds"
instead of a flat list, with XP, streaks, and levels built in to make
finishing things feel rewarding.

Built with Swift and AppKit. No installation from an app store, no
account, no network requests except loading two Google Fonts. Everything
is stored locally on your machine.

*Requires macOS.*

## One-time setup

**1. Check you have the Swift compiler.**

Open Terminal and run:
```
xcode-select -p
```
If that prints a path, you're set. If it errors instead, run:
```
xcode-select --install
```
and follow the prompts. This installs Apple's free Command Line Tools —
no full Xcode install required, and it only takes a few minutes.

**2. Build it.**

```
cd path/to/bubble-app
chmod +x build.sh run.sh
./build.sh
```

This compiles `main.swift` into a binary called `CumulusBubble` in the
same folder.

**3. Run it.**

```
./run.sh
```

A small dark circle with a cloud icon appears in the top-right corner of
the screen.

## Using it

- **Click** the bubble to open the task manager in a small window.
- **Click again** (the bubble, or the open window) to close it.
- **Drag** the bubble anywhere on screen — it stays wherever you drop it.
- **Right-click** the bubble for a Quit option.
- The bubble stays visible across virtual desktops/Spaces.

Inside the app: drop loose thoughts into the Brain Dump, organize tasks
into color-coded clouds, mark due dates and priority, and check things
off to earn XP. Leveling up unlocks new color themes for the sky
background. A streak counter tracks consecutive days of completed tasks,
with one automatic "freeze" to forgive a single missed day.

## Automatic lockdown detection

The app checks the names of currently running applications every few
seconds. If it detects a known exam lockdown or proctoring tool, the
bubble (and its window, if open) hide automatically until that
application closes.

<details>
<summary>Current watchlist / how to extend it</summary>

Matching is a simple case-insensitive substring check against each
running app's name and bundle identifier. Current list: Bluebook,
Respondus LockDown Browser, Honorlock, Proctorio, ProctorU, Examity,
ExamSoft, Safe Exam Browser, SecureTest.

To add more, edit the `lockdownKeywords` array near the top of
`main.swift` and run `./build.sh` again. Pull requests adding
additional known tools are welcome.

</details>

## Where data is stored

`~/Library/Application Support/CumulusBubble/data.json` — plain JSON,
readable and easy to back up manually.

<details>
<summary>Auto-start at login (optional)</summary>

Create a file at `~/Library/LaunchAgents/com.cumulus.bubble.plist`:

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

Replace the path with the actual location of `run.sh` (run `pwd` inside
the project folder to get it), then load it:

```
launchctl load ~/Library/LaunchAgents/com.cumulus.bubble.plist
```

To disable auto-start later: `launchctl unload` the same file.

</details>

## License

GPLv3 — see `LICENSE`. This code can be freely used, run, and modified;
any distributed modified version must remain open source under the same
license.

## Known limitations

- This is unsigned, locally compiled code — completely normal for a
  personal/open-source tool distributed outside the App Store, but
  macOS may show a Gatekeeper warning on first run. Right-click
  `CumulusBubble` → **Open** once to clear it.
- The lockdown-app watchlist is name-based. It can only detect software
  it already knows the name of — it's a helpful safeguard, not a
  guarantee.
- Task data does not sync with any other version of this project (e.g.
  a browser-extension build); each is a separate, independent store.

## Contributing

Issues and pull requests are welcome — particularly additions to the
lockdown-tool watchlist or bug reports.
