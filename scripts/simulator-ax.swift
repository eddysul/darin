import ApplicationServices
import AppKit
import Foundation

func attribute(_ element: AXUIElement, _ name: CFString) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name, &value) == .success else { return nil }
    return value
}

func textAttribute(_ element: AXUIElement, _ name: CFString) -> String {
    (attribute(element, name) as? String) ?? ""
}

func children(of element: AXUIElement) -> [AXUIElement] {
    if let rawChildren = attribute(element, kAXChildrenAttribute as CFString) as? NSArray, rawChildren.count > 0 {
        return rawChildren.compactMap { $0 as! AXUIElement }
    }
    if let rawChildren = attribute(element, "AXChildrenInNavigationOrder" as CFString) as? NSArray {
        return rawChildren.compactMap { $0 as! AXUIElement }
    }
    return []
}

func searchableText(_ element: AXUIElement) -> String {
    [kAXRoleAttribute, kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute]
        .map { textAttribute(element, $0 as CFString) }
        .filter { !$0.isEmpty }
        .joined(separator: " | ")
}

func walk(_ element: AXUIElement, depth: Int, action: String?, target: String?) -> Bool {
    let text = searchableText(element)
    if action == nil, !text.isEmpty {
        print(String(repeating: "  ", count: depth) + text)
    }

    if action == "press", let target, text.localizedCaseInsensitiveContains(target) {
        if AXUIElementPerformAction(element, kAXPressAction as CFString) == .success {
            print("PRESSED: \(text)")
            return true
        }
    }

    for child in children(of: element) {
        if walk(child, depth: depth + 1, action: action, target: target) { return true }
    }
    return false
}

guard let simulator = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.iphonesimulator").first else {
    fputs("Simulator is not running\n", stderr)
    exit(2)
}

let app = AXUIElementCreateApplication(simulator.processIdentifier)
let args = Array(CommandLine.arguments.dropFirst())
if args.first == "click", args.count == 3, let x = Double(args[1]), let y = Double(args[2]) {
    simulator.activate(options: [.activateIgnoringOtherApps])
    usleep(150_000)
    let point = CGPoint(x: x, y: y)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    usleep(100_000)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
    exit(0)
}
if args.first == "drag", args.count == 5,
   let x1 = Double(args[1]), let y1 = Double(args[2]),
   let x2 = Double(args[3]), let y2 = Double(args[4]) {
    simulator.activate(options: [.activateIgnoringOtherApps])
    usleep(150_000)
    let start = CGPoint(x: x1, y: y1)
    let end = CGPoint(x: x2, y: y2)
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left)?.post(tap: .cghidEventTap)
    for step in 1...12 {
        let progress = CGFloat(step) / 12
        let point = CGPoint(x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress)
        CGEvent(mouseEventSource: nil, mouseType: .leftMouseDragged, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
        usleep(12_000)
    }
    CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left)?.post(tap: .cghidEventTap)
    exit(0)
}
let action = args.first
let target = args.dropFirst().joined(separator: " ")
let didAct = walk(app, depth: 0, action: action, target: target.isEmpty ? nil : target)
if action != nil, !didAct { exit(3) }
