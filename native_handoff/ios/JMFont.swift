// JMFont.swift — typography (SwiftUI)
//
// FONT SETUP (one-time):
// 1. Add the bundled fonts to the app target: Anton-Regular.ttf, PublicSans (variable or
//    static weights 400/500/600/700/800/900, plus italics if needed).
//    NOTE: Anton & Public Sans are Google-Fonts substitutes pending the licensed display
//    face — see native_handoff/SKILL.md.
// 2. In Info.plist add the file names under "Fonts provided by application"
//    (UIAppFonts), e.g. <string>Anton-Regular.ttf</string> ...
// 3. The PostScript names used below: "Anton-Regular", "PublicSans-Regular",
//    "PublicSans-SemiBold", "PublicSans-Bold", "PublicSans-ExtraBold", "PublicSans-Black".
//    Verify with: for f in UIFont.familyNames { print(UIFont.fontNames(forFamilyName: f)) }

import SwiftUI

public enum JMFont {
    // Display — Anton, condensed all-caps. Use .textCase(.uppercase) at call sites.
    public static func display(_ size: CGFloat) -> Font { .custom("Anton-Regular", size: size) }

    // Body / UI — Public Sans
    public static func sans(_ size: CGFloat, _ weight: PSWeight = .regular) -> Font {
        .custom(weight.psName, size: size)
    }

    public enum PSWeight {
        case regular, medium, semibold, bold, extrabold, black
        var psName: String {
            switch self {
            case .regular:   return "PublicSans-Regular"
            case .medium:    return "PublicSans-Medium"
            case .semibold:  return "PublicSans-SemiBold"
            case .bold:      return "PublicSans-Bold"
            case .extrabold: return "PublicSans-ExtraBold"
            case .black:     return "PublicSans-Black"
            }
        }
    }

    // Ready-made text styles (size + leading guidance).
    // Display (all-caps headlines, hero numbers) — line spacing tight (~0.96).
    public static let displayXL = display(64)
    public static let displayLG = display(48)
    public static let displayMD = display(36)
    public static let displaySM = display(28)

    // Headings — Public Sans, weight 700–800.
    public static let headingXL = sans(32, .extrabold)
    public static let headingLG = sans(26, .extrabold)
    public static let headingMD = sans(21, .bold)
    public static let headingSM = sans(18, .bold)
    public static let headingXS = sans(16, .bold)

    // Body — Public Sans, leading ~1.55 (use .lineSpacing(size * 0.55)).
    public static let bodyLG = sans(18, .regular)
    public static let bodyMD = sans(16, .regular)
    public static let bodySM = sans(14, .regular)

    // Eyebrow / label — UPPERCASE, wide tracking (~0.06em → .tracking(size * 0.06)).
    public static let labelMD = sans(14, .extrabold)
    public static let labelSM = sans(12, .extrabold)
}

public extension Text {
    /// Eyebrow style: uppercase, extrabold, wide tracking, tertiary ink.
    func jmEyebrow() -> some View {
        self.font(JMFont.labelSM)
            .textCase(.uppercase)
            .tracking(0.7)
            .foregroundColor(JMColor.textSecondary)
    }
}
