// JMColor.swift — Just Marriage color tokens (SwiftUI)
// The ONLY file with hex literals. Reference JMColor.primary etc. everywhere else.
import SwiftUI

public extension Color {
    init(jmHex hex: UInt32) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8)  & 0xFF) / 255.0,
            blue:  Double( hex        & 0xFF) / 255.0,
            opacity: 1.0
        )
    }
}

public enum JMColor {
    // MARK: Brand — Pink (primary)
    public static let pink50  = Color(jmHex: 0xFFE9F6)
    public static let pink100 = Color(jmHex: 0xFFCDEA)
    public static let pink200 = Color(jmHex: 0xFF9FD6)
    public static let pink300 = Color(jmHex: 0xFB6FC0)
    public static let pink400 = Color(jmHex: 0xF846AC)
    public static let pink500 = Color(jmHex: 0xF5269B)
    public static let pink600 = Color(jmHex: 0xD60E82)
    public static let pink700 = Color(jmHex: 0xA80866)
    public static let pink800 = Color(jmHex: 0x7A0A4C)
    public static let pink900 = Color(jmHex: 0x4F0731)

    // MARK: Brand — Cyan (secondary)
    public static let cyan50     = Color(jmHex: 0xE2FBF9)
    public static let cyan100    = Color(jmHex: 0xBAF6F0)
    public static let cyan200    = Color(jmHex: 0x84ECE3)
    public static let cyan300    = Color(jmHex: 0x4DE2D6)
    public static let cyan400    = Color(jmHex: 0x22D8C9)
    public static let cyan500    = Color(jmHex: 0x11C6B8)
    public static let cyan600    = Color(jmHex: 0x0BA194)
    public static let cyan700    = Color(jmHex: 0x0C7E75)
    public static let cyan800    = Color(jmHex: 0x0E625C)
    public static let cyan900    = Color(jmHex: 0x0A413D)
    public static let cyanBright = Color(jmHex: 0x1FE6D8)

    // MARK: Pop accent — Yellow
    public static let yellow300 = Color(jmHex: 0xFFE38A)
    public static let yellow400 = Color(jmHex: 0xFFD23E)
    public static let yellow500 = Color(jmHex: 0xF5B600)

    // MARK: Ink / neutrals
    public static let ink900 = Color(jmHex: 0x15161B)
    public static let ink800 = Color(jmHex: 0x232530)
    public static let ink700 = Color(jmHex: 0x3A3D4A)
    public static let ink600 = Color(jmHex: 0x585C6B)
    public static let ink500 = Color(jmHex: 0x80848F)
    public static let ink400 = Color(jmHex: 0xA9ADB7)
    public static let ink300 = Color(jmHex: 0xD2D5DC)
    public static let ink200 = Color(jmHex: 0xE7E9EE)
    public static let ink100 = Color(jmHex: 0xF2F3F6)
    public static let ink50  = Color(jmHex: 0xFAFAFB)
    public static let white  = Color(jmHex: 0xFFFFFF)
    public static let black  = Color(jmHex: 0x000000)

    public static let canvas       = Color(jmHex: 0xFBFAF8)
    public static let canvasSunken = Color(jmHex: 0xF4F2EE)

    // MARK: Status (restrained)
    public static let green500 = Color(jmHex: 0x1FB873)
    public static let green50  = Color(jmHex: 0xDEF7EC)
    public static let amber500 = Color(jmHex: 0xFFB020)
    public static let amber50  = Color(jmHex: 0xFFF3D6)
    public static let red500   = Color(jmHex: 0xFF4D5E)
    public static let red50    = Color(jmHex: 0xFFE3E6)

    // MARK: Semantic aliases — use THESE in UI
    public static let primary       = pink500
    public static let primaryHover  = pink600
    public static let primaryPress  = pink700
    public static let primarySoft   = pink50
    public static let onPrimary     = white

    public static let secondary      = cyanBright
    public static let secondaryHover = cyan400
    public static let secondaryPress = cyan500
    public static let secondarySoft  = cyan50
    public static let onSecondary    = ink900

    public static let ink     = ink900
    public static let accent  = yellow400
    public static let onAccent = ink900

    public static let textPrimary   = ink900
    public static let textSecondary = ink600
    public static let textTertiary  = ink500
    public static let textDisabled  = ink400

    public static let surfacePage    = canvas
    public static let surfaceCard    = white
    public static let surfaceSunken  = canvasSunken
    public static let surfaceInverse = ink900

    public static let borderSubtle  = ink200
    public static let borderDefault = ink300
    public static let borderStrong  = ink900

    public static let success = green500
    public static let warning = amber500
    public static let error   = red500
    public static let info    = cyan600
}
