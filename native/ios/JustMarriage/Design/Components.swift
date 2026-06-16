// Components.swift — Just Marriage SwiftUI component recipes.
// These mirror the web design system's contracts (see ../components.md). Copy what you
// need; they depend only on JMColor / JMTheme / JMFont.
import SwiftUI

// MARK: - Button

public enum JMButtonVariant { case primary, secondary, ink, outline, ghost }
public enum JMButtonSize { case sm, md, lg }

public struct JMButton: View {
    let title: String
    var variant: JMButtonVariant = .primary
    var size: JMButtonSize = .md
    var pill: Bool = false
    var fullWidth: Bool = false
    var systemIcon: String? = nil
    let action: () -> Void

    public init(_ title: String, variant: JMButtonVariant = .primary, size: JMButtonSize = .md,
                pill: Bool = false, fullWidth: Bool = false, systemIcon: String? = nil,
                action: @escaping () -> Void) {
        self.title = title; self.variant = variant; self.size = size
        self.pill = pill; self.fullWidth = fullWidth; self.systemIcon = systemIcon; self.action = action
    }

    private var height: CGFloat { switch size { case .sm: 36; case .md: 46; case .lg: 56 } }
    private var fontSize: CGFloat { switch size { case .sm: 13; case .md: 15; case .lg: 16 } }
    private var bg: Color {
        switch variant { case .primary: JMColor.primary; case .secondary: JMColor.secondary
        case .ink: JMColor.ink900; case .outline, .ghost: .clear }
    }
    private var fg: Color {
        switch variant { case .primary, .ink: JMColor.white; case .secondary: JMColor.onSecondary
        case .outline, .ghost: JMColor.ink900 }
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon = systemIcon { Image(systemName: icon) }
                Text(title).font(JMFont.sans(fontSize, .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.86)
            }
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .frame(height: height)
            .padding(.horizontal, size == .lg ? 30 : 22)
            .background(bg)
            .foregroundColor(fg)
            .overlay(
                RoundedRectangle(cornerRadius: pill ? JMRadius.pill : JMRadius.md, style: .continuous)
                    .strokeBorder(variant == .outline ? JMColor.ink900 : .clear, lineWidth: JMBorder.widthBold)
            )
            .clipShape(RoundedRectangle(cornerRadius: pill ? JMRadius.pill : JMRadius.md, style: .continuous))
        }
        .buttonStyle(JMPressStyle())
    }
}

/// Springy press scale used across interactive elements.
public struct JMPressStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(JMMotion.spring, value: configuration.isPressed)
    }
}

// MARK: - Badge (incl. tilted "100%" sticker tag)

public enum JMBadgeTone { case ink, pink, cyan, yellow, success, warning, error }

public struct JMBadge: View {
    let text: String
    var tone: JMBadgeTone = .ink
    var soft: Bool = false
    var tilt: Bool = false
    var uppercased: Bool = false

    public init(_ text: String, tone: JMBadgeTone = .ink, soft: Bool = false,
                tilt: Bool = false, uppercased: Bool = false) {
        self.text = text; self.tone = tone; self.soft = soft; self.tilt = tilt; self.uppercased = uppercased
    }

    private var pair: (bg: Color, fg: Color) {
        switch tone {
        case .ink:     return soft ? (JMColor.ink100, JMColor.ink900)   : (JMColor.ink900, JMColor.white)
        case .pink:    return soft ? (JMColor.pink50, JMColor.pink700)  : (JMColor.pink500, JMColor.white)
        case .cyan:    return soft ? (JMColor.cyan50, JMColor.cyan700)  : (JMColor.cyanBright, JMColor.ink900)
        case .yellow:  return (JMColor.yellow400, JMColor.ink900)
        case .success: return soft ? (JMColor.green50, JMColor.green500): (JMColor.green500, JMColor.white)
        case .warning: return soft ? (JMColor.amber50, JMColor.amber500): (JMColor.amber500, JMColor.ink900)
        case .error:   return soft ? (JMColor.red50, JMColor.red500)    : (JMColor.red500, JMColor.white)
        }
    }

    public var body: some View {
        Text(uppercased ? text.uppercased() : text)
            .font(JMFont.sans(13, .extrabold))
            .tracking(uppercased ? 0.5 : 0.1)
            .padding(.vertical, 4).padding(.horizontal, 11)
            .background(pair.bg)
            .foregroundColor(pair.fg)
            .clipShape(Capsule())
            .rotationEffect(.degrees(tilt ? -4 : 0))
    }
}

// MARK: - Card

public enum JMCardVariant { case plain, hard, tinted }

public struct JMCard<Content: View>: View {
    var variant: JMCardVariant = .plain
    var tint: Color = JMColor.cyan50
    var padding: CGFloat = JMSpace.x5
    @ViewBuilder let content: () -> Content

    public init(variant: JMCardVariant = .plain, tint: Color = JMColor.cyan50,
                padding: CGFloat = JMSpace.x5, @ViewBuilder content: @escaping () -> Content) {
        self.variant = variant; self.tint = tint; self.padding = padding; self.content = content
    }

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: JMRadius.lg, style: .continuous)
        return VStack(alignment: .leading, spacing: JMSpace.x3) {
            content()
        }
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(variant == .tinted ? tint : JMColor.surfaceCard)
            .clipShape(shape)
            .overlay(
                shape.strokeBorder(
                    variant == .hard ? JMColor.ink900 : (variant == .plain ? JMColor.borderSubtle : .clear),
                    lineWidth: variant == .hard ? JMBorder.widthBold : JMBorder.width)
            )
            .background(
                variant == .hard
                    ? shape.fill(JMColor.ink900).offset(x: 4, y: 4)
                    : nil
            )
            .modifier(SoftShadow(on: variant == .plain))
    }
}

private struct SoftShadow: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        on ? AnyView(content.jmShadow(.sm)) : AnyView(content)
    }
}

// MARK: - ProgressRing (match-score dial)

public struct JMProgressRing: View {
    var value: Double            // 0...100
    var size: CGFloat = 120
    var thickness: CGFloat = 12
    var sublabel: String? = nil

    public init(value: Double, size: CGFloat = 120, thickness: CGFloat = 12, sublabel: String? = nil) {
        self.value = value; self.size = size; self.thickness = thickness; self.sublabel = sublabel
    }

    public var body: some View {
        ZStack {
            Circle().stroke(JMColor.ink100, lineWidth: thickness)
            Circle()
                .trim(from: 0, to: CGFloat(min(100, max(0, value)) / 100))
                .stroke(
                    AngularGradient(colors: [JMColor.pink500, JMColor.cyanBright],
                                    center: .center),
                    style: StrokeStyle(lineWidth: thickness, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(JMMotion.easeOut, value: value)
            VStack(spacing: 2) {
                Text("\(Int(value))%").font(JMFont.display(size * 0.3))
                    .foregroundColor(JMColor.ink900)
                if let s = sublabel {
                    Text(s.uppercased()).font(JMFont.sans(size * 0.1, .bold))
                        .tracking(1).foregroundColor(JMColor.textTertiary)
                }
            }
        }
        .frame(width: size, height: size)
    }
}

// MARK: - VoiceBars (counselor visualizer)

public struct JMVoiceBars: View {
    var active: Bool = true
    var barCount: Int = 7
    var tint: Color = JMColor.pink500
    var height: CGFloat = 80
    private static let idleBarScales: [CGFloat] = [0.32, 0.44, 0.36, 0.52, 0.36, 0.44, 0.32]
    @State private var phase = false

    public init(active: Bool = true, barCount: Int = 7, tint: Color = JMColor.pink500, height: CGFloat = 80) {
        self.active = active; self.barCount = barCount; self.tint = tint; self.height = height
    }

    public var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<barCount, id: \.self) { i in
                Capsule().fill(tint)
                    .frame(width: 8, height: active ? height * barScale(i) : height * idleBarScale(i))
                    .opacity(active ? 1 : 0.82)
                    .animation(
                        active
                        ? .easeInOut(duration: 0.9).repeatForever().delay(Double(i % 4) * 0.12)
                        : .default,
                        value: phase)
            }
        }
        .frame(height: height)
        .onAppear { phase.toggle() }
    }
    private func barScale(_ i: Int) -> CGFloat { phase ? (i % 2 == 0 ? 1.0 : 0.5) : (i % 2 == 0 ? 0.3 : 0.9) }
    private func idleBarScale(_ i: Int) -> CGFloat {
        Self.idleBarScales[i % Self.idleBarScales.count]
    }
}

// MARK: - ScaleRating (1–10 importance)

public struct JMScaleRating: View {
    @Binding var value: Int?
    var range: ClosedRange<Int> = 1...10
    var lowLabel: String? = nil
    var highLabel: String? = nil

    public init(value: Binding<Int?>, range: ClosedRange<Int> = 1...10,
                lowLabel: String? = nil, highLabel: String? = nil) {
        self._value = value; self.range = range; self.lowLabel = lowLabel; self.highLabel = highLabel
    }

    public var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 6) {
                ForEach(Array(range), id: \.self) { n in
                    let on = value == n
                    Button { value = n } label: {
                        Text("\(n)").font(JMFont.sans(15, .bold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(on ? JMColor.ink900 : JMColor.white)
                            .foregroundColor(on ? JMColor.white : JMColor.ink700)
                            .overlay(RoundedRectangle(cornerRadius: JMRadius.sm)
                                .strokeBorder(on ? JMColor.ink900 : JMColor.borderDefault, lineWidth: JMBorder.width))
                            .clipShape(RoundedRectangle(cornerRadius: JMRadius.sm))
                            .offset(y: on ? -2 : 0)
                    }.buttonStyle(.plain)
                }
            }
            if lowLabel != nil || highLabel != nil {
                HStack {
                    Text(lowLabel ?? "").font(JMFont.sans(12)).foregroundColor(JMColor.textTertiary)
                    Spacer()
                    Text(highLabel ?? "").font(JMFont.sans(12)).foregroundColor(JMColor.textTertiary)
                }
            }
        }
    }
}

// MARK: - LockedAvatar (modesty model)

public struct JMAvatar: View {
    var initials: String = ""
    var locked: Bool = false
    var size: CGFloat = 48
    var tint: Color = JMColor.pink100

    public init(initials: String = "", locked: Bool = false, size: CGFloat = 48, tint: Color = JMColor.pink100) {
        self.initials = initials; self.locked = locked; self.size = size; self.tint = tint
    }

    public var body: some View {
        ZStack {
            Circle().fill(locked ? JMColor.ink200 : tint)
            if locked {
                Image(systemName: "lock.fill").font(.system(size: size * 0.4)).foregroundColor(JMColor.ink500)
            } else {
                Text(initials).font(JMFont.sans(size * 0.38, .bold)).foregroundColor(JMColor.pink700)
            }
        }
        .frame(width: size, height: size)
    }
}
