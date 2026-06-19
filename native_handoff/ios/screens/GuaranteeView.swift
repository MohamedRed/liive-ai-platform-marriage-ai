// GuaranteeView.swift — how the 6-month money-back promise works (SwiftUI).
import SwiftUI

struct GuaranteeView: View {
    @Environment(\.dismiss) private var dismiss

    private let steps: [(String, String, String, String)] = [
        ("01", "Pay once, upfront", "A single membership fee — no subscriptions, no hidden costs.", "creditcard.fill"),
        ("02", "We build & match", "Your AI counselor builds a deep profile and searches for true compatibility.", "mic.fill"),
        ("03", "Meet your 99% match", "A wali-approved match within six months — that's the promise.", "heart.fill"),
        ("04", "Or full refund", "No match in six months? Every penny back. The confidence is on us.", "checkmark.shield.fill"),
    ]

    var body: some View {
        ZStack {
            JMColor.surfacePage.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: JMSpace.x4) {
                    HStack {
                        Button { dismiss() } label: {
                            Image(systemName: "xmark").font(.system(size: 17, weight: .bold))
                                .foregroundColor(JMColor.ink700).frame(width: 38, height: 38)
                                .background(JMColor.ink100).clipShape(Circle())
                        }
                        Text("The guarantee").font(JMFont.headingSM)
                    }

                    JMBadge("Unseen in this industry", tone: .pink, soft: true, uppercased: true)
                    (Text("A match in 6 months,\n") + Text("or your money back"))
                        .font(JMFont.display(38)).foregroundColor(JMColor.ink900).textCase(.uppercase).lineSpacing(-4)
                    Text("Dating apps profit when you stay single. We only win when you marry — so we put the fee on the line.")
                        .font(JMFont.sans(15.5)).foregroundColor(JMColor.textSecondary).lineSpacing(3)

                    VStack(spacing: JMSpace.x3) {
                        ForEach(steps, id: \.0) { s in
                            HStack(alignment: .top, spacing: 14) {
                                Text(s.0).font(JMFont.display(26)).foregroundColor(JMColor.pink500).frame(width: 34, alignment: .leading)
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack(spacing: 8) {
                                        Image(systemName: s.3).foregroundColor(s.0 == "04" ? JMColor.cyan600 : JMColor.ink700)
                                        Text(s.1).font(JMFont.sans(16, .extrabold))
                                    }
                                    Text(s.2).font(JMFont.sans(14)).foregroundColor(JMColor.textSecondary).lineSpacing(2)
                                }
                                Spacer()
                            }
                            .padding(16)
                            .background(JMColor.surfaceCard)
                            .overlay(RoundedRectangle(cornerRadius: JMRadius.lg).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
                            .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))
                        }
                    }

                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "checkmark.circle.fill").foregroundColor(JMColor.cyan700)
                        Text("Keeping it simple: stay active and complete your profile to qualify. A wali-approved match counts as a match.")
                            .font(JMFont.sans(13.5)).foregroundColor(JMColor.cyan900).lineSpacing(2)
                    }
                    .padding(16).background(JMColor.cyan50).clipShape(RoundedRectangle(cornerRadius: JMRadius.md))

                    JMButton("See membership", variant: .ink, size: .lg, fullWidth: true) { dismiss() }
                }
                .padding(JMSpace.x5)
            }
        }
    }
}
