// MembershipView.swift — premium paywall, guarantee-first (SwiftUI).
import SwiftUI

let JM_PRICE = "£2,500" // one-time. Set the real figure here.

struct MembershipView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var showGuarantee = false

    private let included: [(String, String)] = [
        ("checkmark.shield.fill", "Verified, marriage-intent members only"),
        ("mic.fill", "Unlimited AI counselor sessions"),
        ("heart.fill", "Curated matches scored to 99% compatibility"),
        ("shield.lefthalf.filled", "Wali kept in the loop at every step"),
    ]

    var body: some View {
        ZStack {
            JMColor.ink900.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: JMSpace.x4) {
                    HStack {
                        Button { dismiss() } label: {
                            Image(systemName: "xmark").font(.system(size: 17, weight: .bold))
                                .foregroundColor(.white).frame(width: 38, height: 38)
                                .background(Color.white.opacity(0.1)).clipShape(Circle())
                        }
                        Text("Membership").font(JMFont.headingSM).foregroundColor(.white)
                    }

                    JMBadge("One membership · one purpose", tone: .cyan, uppercased: true)

                    (Text("The 99%\n") + Text("guarantee"))
                        .font(JMFont.display(46)).foregroundColor(.white).textCase(.uppercase).lineSpacing(-6)

                    Text("We're so confident we'll find your match, we'll stake the whole fee on it.")
                        .font(JMFont.sans(16)).foregroundColor(.white.opacity(0.82)).lineSpacing(4)

                    // Promise sticker card
                    ZStack(alignment: .topLeading) {
                        RoundedRectangle(cornerRadius: JMRadius.xl).fill(JMColor.pink500).offset(x: 6, y: 6)
                        VStack {
                            HStack(spacing: 14) {
                                JMProgressRing(value: 99, size: 88, thickness: 9, sublabel: "match")
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Matched in 6 months").font(JMFont.display(24)).textCase(.uppercase)
                                        .foregroundColor(JMColor.ink900)
                                    Text("— or every penny back.").font(JMFont.sans(15, .extrabold))
                                        .foregroundColor(JMColor.pink600)
                                }
                            }.padding(22)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(JMColor.white)
                        .overlay(RoundedRectangle(cornerRadius: JMRadius.xl).strokeBorder(JMColor.ink900, lineWidth: 2.5))
                        .clipShape(RoundedRectangle(cornerRadius: JMRadius.xl))
                    }
                    .padding(.vertical, JMSpace.x2)

                    // Price
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(JM_PRICE).font(JMFont.display(56)).foregroundColor(.white)
                        Text("one-time · fully refundable").font(JMFont.sans(14, .bold)).foregroundColor(.white.opacity(0.7))
                    }
                    Text("No swiping subscriptions. One serious step, backed by a promise.")
                        .font(JMFont.sans(13.5)).foregroundColor(.white.opacity(0.6))

                    // Included
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(included, id: \.0) { item in
                            HStack(spacing: 12) {
                                Image(systemName: item.0).foregroundColor(JMColor.cyanBright).frame(width: 24)
                                Text(item.1).font(JMFont.sans(15)).foregroundColor(.white)
                            }
                        }
                    }.padding(.top, JMSpace.x3)

                    JMButton("Join Just Marriage", variant: .primary, size: .lg, fullWidth: true, systemIcon: "arrow.right") { dismiss() }
                        .padding(.top, JMSpace.x3)
                    Button { showGuarantee = true } label: {
                        HStack(spacing: 6) { Image(systemName: "info.circle.fill"); Text("How the guarantee works") }
                            .font(JMFont.sans(14, .bold)).foregroundColor(JMColor.cyanBright)
                            .frame(maxWidth: .infinity).padding(.top, 8)
                    }
                    Text("Refund applies when your profile is complete and you stay active. A wali-approved match counts as a match.")
                        .font(JMFont.sans(12)).foregroundColor(.white.opacity(0.5)).multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }
                .padding(JMSpace.x5)
            }
        }
        .sheet(isPresented: $showGuarantee) { GuaranteeView().presentationDetents([.large]) }
    }
}
