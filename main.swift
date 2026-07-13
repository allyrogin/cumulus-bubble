// Cumulus Bubble — a floating ADHD-friendly task bubble for macOS
// Copyright (C) 2026 Ally
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import Cocoa
import WebKit
import QuartzCore

// ============================================================
// CONFIG — edit this list to add more lockdown/proctoring apps.
// Matching is a simple lowercase substring check against both the
// app's display name and its bundle identifier, so partial names
// are fine (e.g. "respondus" matches "Respondus LockDown Browser").
// ============================================================

let lockdownKeywords: [String] = [
    "bluebook",
    "lockdown browser",
    "lockdownbrowser",
    "respondus",
    "honorlock",
    "proctorio",
    "proctoru",
    "examity",
    "examsoft",
    "safe exam browser",
    "safeexambrowser",
    "securetest",
]
let bubbleDiameter: CGFloat = 58
let popupSize = NSSize(width: 440, height: 700)
let watcherInterval: TimeInterval = 3.0

// ============================================================
// Paths — resources live next to this executable, saved data
// lives in Application Support so it survives app rebuilds.
// ============================================================

func appDirectory() -> URL {
    let exeURL = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath()
    return exeURL.deletingLastPathComponent()
}

func resourceDirectory() -> URL {
    appDirectory().appendingPathComponent("Resources")
}

func dataFileURL() -> URL {
    let supportDir = FileManager.default
        .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("CumulusBubble")
    try? FileManager.default.createDirectory(at: supportDir, withIntermediateDirectories: true)
    return supportDir.appendingPathComponent("data.json")
}

func loadSavedDataJSON() -> String {
    let url = dataFileURL()
    if let contents = try? String(contentsOf: url, encoding: .utf8), !contents.isEmpty {
        return contents
    }
    return "null"
}

func writeDataJSON(_ json: String) {
    try? json.write(to: dataFileURL(), atomically: true, encoding: .utf8)
}

// ============================================================
// BubbleView — the little circle. Handles drag-to-move and
// click-to-toggle (a drag past a few pixels is not a click).
// ============================================================

final class BubbleView: NSView {
    weak var controller: AppController?
    private var dragAnchor: NSPoint = .zero
    private var windowAnchorOrigin: NSPoint = .zero
    private var didDrag = false

    override func draw(_ dirtyRect: NSRect) {
        // base circle
        let base = NSBezierPath(ovalIn: bounds.insetBy(dx: 3, dy: 3))
        NSColor(calibratedRed: 0.20, green: 0.18, blue: 0.36, alpha: 0.94).setFill()
        base.fill()

        // soft border ring
        NSColor(calibratedWhite: 1.0, alpha: 0.16).setStroke()
        base.lineWidth = 1.5
        base.stroke()

        // cloud glyph: a rounded body + two overlapping puffs, gold-ish
        let cloudColor = NSColor(calibratedRed: 1.0, green: 0.78, blue: 0.34, alpha: 1.0)
        cloudColor.setFill()

        let cw = bounds.width * 0.50
        let ch = bounds.height * 0.26
        let cx = bounds.midX
        let cy = bounds.midY - bounds.height * 0.03

        let body = NSBezierPath(
            roundedRect: NSRect(x: cx - cw / 2, y: cy - ch / 2, width: cw, height: ch),
            xRadius: ch / 2, yRadius: ch / 2
        )
        body.fill()

        let puff1Size = ch * 1.05
        let puff1 = NSBezierPath(ovalIn: NSRect(
            x: cx - cw * 0.32, y: cy - ch * 0.05, width: puff1Size, height: puff1Size
        ))
        puff1.fill()

        let puff2Size = ch * 1.30
        let puff2 = NSBezierPath(ovalIn: NSRect(
            x: cx + cw * 0.00, y: cy + ch * 0.02, width: puff2Size, height: puff2Size
        ))
        puff2.fill()
    }

    override func mouseDown(with event: NSEvent) {
        dragAnchor = NSEvent.mouseLocation
        windowAnchorOrigin = window?.frame.origin ?? .zero
        didDrag = false
    }

    override func mouseDragged(with event: NSEvent) {
        guard let window = window else { return }
        let current = NSEvent.mouseLocation
        let dx = current.x - dragAnchor.x
        let dy = current.y - dragAnchor.y
        if abs(dx) > 3 || abs(dy) > 3 { didDrag = true }
        window.setFrameOrigin(NSPoint(x: windowAnchorOrigin.x + dx, y: windowAnchorOrigin.y + dy))
        controller?.repositionPopupIfOpen()
    }

    override func mouseUp(with event: NSEvent) {
        if !didDrag {
            controller?.toggleBubbleClicked()
        }
    }

    override func rightMouseDown(with event: NSEvent) {
        let menu = NSMenu()
        let quitItem = NSMenuItem(title: "Quit Cumulus Bubble", action: #selector(quitApp), keyEquivalent: "")
        quitItem.target = self
        menu.addItem(quitItem)
        NSMenu.popUpContextMenu(menu, with: event, for: self)
    }

    @objc func quitApp() {
        NSApp.terminate(nil)
    }
}

// ============================================================
// AppController — owns both windows, the WKWebView, the native
// storage bridge, and the lockdown-app watcher.
// ============================================================

final class AppController: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    var bubbleWindow: NSWindow!
    var popupWindow: NSWindow?
    var webView: WKWebView?
    var isHiddenForLockdown = false
    var manuallyClosed = true

    func start() {
        setupBubbleWindow()
        startLockdownWatcher()
    }

    // ---- Bubble window ----

    func setupBubbleWindow() {
        let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let origin = NSPoint(x: screenFrame.maxX - bubbleDiameter - 26, y: screenFrame.maxY - bubbleDiameter - 26)
        let rect = NSRect(origin: origin, size: NSSize(width: bubbleDiameter, height: bubbleDiameter))

        let window = NSWindow(contentRect: rect, styleMask: [.borderless], backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        window.isMovableByWindowBackground = false

        let view = BubbleView(frame: NSRect(origin: .zero, size: rect.size))
        view.controller = self
        window.contentView = view

        window.orderFrontRegardless()
        bubbleWindow = window
    }

    // ---- Popup window (the actual app, shrunk down) ----

    func toggleBubbleClicked() {
        if let popup = popupWindow, popup.isVisible {
            manuallyClosed = true
            animateOut(popup)
        } else {
            manuallyClosed = false
            showPopup()
        }
    }

    func repositionPopupIfOpen() {
        guard let popup = popupWindow, popup.isVisible else { return }
        popup.setFrameOrigin(popupOrigin())
    }

    func popupOrigin() -> NSPoint {
        guard let bubble = bubbleWindow else { return .zero }
        let bubbleFrame = bubble.frame
        var origin = NSPoint(
            x: bubbleFrame.minX - popupSize.width + bubbleFrame.width,
            y: bubbleFrame.minY - popupSize.height - 14
        )
        if let screen = NSScreen.main?.visibleFrame {
            origin.x = max(screen.minX + 8, min(origin.x, screen.maxX - popupSize.width - 8))
            origin.y = max(screen.minY + 8, min(origin.y, screen.maxY - popupSize.height - 8))
        }
        return origin
    }

    func showPopup() {
        if popupWindow == nil {
            createPopupWindow()
        }
        guard let popup = popupWindow else { return }

        let origin = popupOrigin()
        popup.setFrame(NSRect(origin: origin, size: NSSize(width: popupSize.width, height: 1)), display: false)
        popup.alphaValue = 0
        popup.orderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.22
            ctx.timingFunction = CAMediaTimingFunction(name: .easeOut)
            popup.animator().setFrame(NSRect(origin: origin, size: popupSize), display: true)
            popup.animator().alphaValue = 1
        }
    }

    func animateOut(_ popup: NSWindow) {
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.16
            ctx.timingFunction = CAMediaTimingFunction(name: .easeIn)
            popup.animator().alphaValue = 0
        }, completionHandler: {
            popup.orderOut(nil)
        })
    }

    func createPopupWindow() {
        let seedScript = WKUserScript(
            source: "window.__CUMULUS_NATIVE_SEED__ = \(loadSavedDataJSON());",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        let contentController = WKUserContentController()
        contentController.addUserScript(seedScript)
        contentController.add(self, name: "cumulusNative")

        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.websiteDataStore = WKWebsiteDataStore.default()

        let webView = WKWebView(frame: NSRect(origin: .zero, size: popupSize), configuration: config)
        webView.navigationDelegate = self
        self.webView = webView

        let indexURL = resourceDirectory().appendingPathComponent("newtab.html")
        webView.loadFileURL(indexURL, allowingReadAccessTo: resourceDirectory())

        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: popupSize),
            styleMask: [.titled, .closable, .fullSizeContentView, .resizable],
            backing: .buffered, defer: false
        )
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.minSize = NSSize(width: 340, height: 460)
        window.contentView = webView
        window.isReleasedWhenClosed = false

        self.popupWindow = window
    }

    // WKScriptMessageHandler — the web app calls this on every save.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "cumulusNative", let json = message.body as? String else { return }
        writeDataJSON(json)
    }

    // ---- Lockdown-app watcher ----

    func startLockdownWatcher() {
        Timer.scheduledTimer(withTimeInterval: watcherInterval, repeats: true) { [weak self] _ in
            self?.checkLockdownApps()
        }
        checkLockdownApps()
    }

    func checkLockdownApps() {
        let running = NSWorkspace.shared.runningApplications
        let found = running.contains { app in
            let name = (app.localizedName ?? "").lowercased()
            let bundleId = (app.bundleIdentifier ?? "").lowercased()
            return lockdownKeywords.contains { name.contains($0) || bundleId.contains($0) }
        }

        if found && !isHiddenForLockdown {
            isHiddenForLockdown = true
            bubbleWindow.orderOut(nil)
            if let popup = popupWindow, popup.isVisible {
                popup.orderOut(nil)
            }
        } else if !found && isHiddenForLockdown {
            isHiddenForLockdown = false
            bubbleWindow.orderFrontRegardless()
            // popup stays closed even after lockdown ends — user re-opens via bubble
        }
    }
}

// ============================================================
// Entry point
// ============================================================

let app = NSApplication.shared
app.setActivationPolicy(.accessory) // no Dock icon, no app switcher entry

let controller = AppController()
controller.start()

app.run()
