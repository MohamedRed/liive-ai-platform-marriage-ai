import Foundation

enum VisualParityScreen: String {
    case talkActive = "talk-active"
    case talkIdle = "talk-idle"
    case talkType = "talk-type"
    case matches
    case matchDetail = "match-detail"
    case profile
    case wali
    case verification
    case chat
    case settings

    var tab: AppTab? {
        switch self {
        case .talkActive, .talkIdle, .talkType:
            return .talk
        case .matches, .matchDetail:
            return .matches
        case .profile:
            return .profile
        case .wali:
            return .wali
        case .settings:
            return .settings
        case .verification, .chat:
            return nil
        }
    }
}

enum VisualParityLaunch {
    static func processScreen() -> VisualParityScreen? {
        let args = ProcessInfo.processInfo.arguments
        if let index = args.firstIndex(of: "-visual-screen"), args.indices.contains(index + 1) {
            return parse(args[index + 1])
        }
        if let raw = ProcessInfo.processInfo.environment["VISUAL_SCREEN"] {
            return parse(raw)
        }
        return nil
    }

    static func parse(_ raw: String?) -> VisualParityScreen? {
        guard let normalized = raw?.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "_", with: "-")
        else { return nil }
        return VisualParityScreen(rawValue: normalized)
    }
}
