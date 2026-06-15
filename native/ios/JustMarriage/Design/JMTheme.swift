// JMTheme.swift — spacing, radius, borders, shadows, motion (SwiftUI)
import SwiftUI

public enum JMSpace {
    public static let x0: CGFloat = 0
    public static let x1: CGFloat = 4
    public static let x2: CGFloat = 8
    public static let x3: CGFloat = 12
    public static let x4: CGFloat = 16
    public static let x5: CGFloat = 20
    public static let x6: CGFloat = 24
    public static let x8: CGFloat = 32
    public static let x10: CGFloat = 40
    public static let x12: CGFloat = 48
    public static let x16: CGFloat = 64
    public static let x20: CGFloat = 80
    public static let x24: CGFloat = 96
    public static let gutter: CGFloat = 20
}

public enum JMRadius {
    public static let xs: CGFloat = 6
    public static let sm: CGFloat = 10
    public static let md: CGFloat = 14
    public static let lg: CGFloat = 20
    public static let xl: CGFloat = 28
    public static let xxl: CGFloat = 36
    public static let pill: CGFloat = 999
}

public enum JMBorder {
    public static let width: CGFloat = 1.5
    public static let widthBold: CGFloat = 2.5
}

// Shadow recipes. Soft elevation for app surfaces; `hard` is the brand sticker/poster
// offset shadow (solid, no blur). Apply via the View helpers below.
public struct JMShadow {
    public let color: Color
    public let radius: CGFloat
    public let x: CGFloat
    public let y: CGFloat

    public static let xs = JMShadow(color: Color(jmHex: 0x15161B).opacity(0.06), radius: 1,  x: 0, y: 1)
    public static let sm = JMShadow(color: Color(jmHex: 0x15161B).opacity(0.08), radius: 4,  x: 0, y: 2)
    public static let md = JMShadow(color: Color(jmHex: 0x15161B).opacity(0.10), radius: 12, x: 0, y: 8)
    public static let lg = JMShadow(color: Color(jmHex: 0x15161B).opacity(0.14), radius: 24, x: 0, y: 18)
}

public extension View {
    func jmShadow(_ s: JMShadow) -> some View {
        self.shadow(color: s.color, radius: s.radius, x: s.x, y: s.y)
    }

    /// Brand "hard" sticker shadow — a solid offset with no blur.
    func jmHardShadow(color: Color = JMColor.ink900, offset: CGFloat = 4) -> some View {
        self.background(
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: JMRadius.lg, style: .continuous)
                    .fill(color)
                    .offset(x: offset, y: offset)
            }
        )
    }
}

public enum JMMotion {
    public static let fast: Double = 0.12
    public static let base: Double = 0.20
    public static let slow: Double = 0.36
    /// Snappy ease-out.
    public static let easeOut = Animation.timingCurve(0.22, 1, 0.36, 1, duration: base)
    /// Springy — for presses & toggles.
    public static let spring = Animation.spring(response: 0.32, dampingFraction: 0.62)
}
