// VerifyView.swift — phone OTP entry (SwiftUI).
import SwiftUI

struct VerifyView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var code: [String] = ["", "", "", ""]
    @FocusState private var focused: Int?

    var body: some View {
        ZStack {
            JMColor.surfacePage.ignoresSafeArea()
            VStack(alignment: .leading, spacing: JMSpace.x4) {
                HStack(spacing: 10) {
                    Button { dismiss() } label: {
                        Image(systemName: "arrow.left").font(.system(size: 18, weight: .semibold))
                            .foregroundColor(JMColor.ink700).frame(width: 38, height: 38)
                            .background(JMColor.ink100).clipShape(Circle())
                    }
                    Text("Verification").font(JMFont.headingSM)
                }

                JMBadge("Step 1 of 2 · Phone", tone: .cyan, soft: true, uppercased: true)
                Text("Verify your number").font(JMFont.headingLG)
                (Text("We sent a 4-digit code to ") + Text("+44 7•• ••• 204").bold())
                    .font(JMFont.sans(15)).foregroundColor(JMColor.textSecondary)

                HStack(spacing: 12) {
                    ForEach(0..<4) { i in
                        TextField("", text: $code[i])
                            .keyboardType(.numberPad).multilineTextAlignment(.center)
                            .font(JMFont.display(30)).foregroundColor(JMColor.ink900)
                            .frame(height: 64).frame(maxWidth: .infinity)
                            .background(JMColor.surfaceCard)
                            .overlay(RoundedRectangle(cornerRadius: JMRadius.md)
                                .strokeBorder(code[i].isEmpty ? JMColor.ink200 : JMColor.pink500, lineWidth: 2))
                            .clipShape(RoundedRectangle(cornerRadius: JMRadius.md))
                            .focused($focused, equals: i)
                            .onChange(of: code[i]) { v in
                                if v.count > 1 { code[i] = String(v.prefix(1)) }
                                if !v.isEmpty && i < 3 { focused = i + 1 }
                            }
                    }
                }.padding(.vertical, JMSpace.x4)

                (Text("Didn't get it? ").foregroundColor(JMColor.textTertiary)
                    + Text("Resend in 0:24").foregroundColor(JMColor.pink600).bold())
                    .font(JMFont.sans(14))

                Spacer()

                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "checkmark.shield.fill").foregroundColor(JMColor.cyan700)
                    Text("Next: a quick identity check keeps the platform safe and serious for everyone.")
                        .font(JMFont.sans(13)).foregroundColor(JMColor.cyan900).lineSpacing(2)
                }
                .padding(14).background(JMColor.cyan50).clipShape(RoundedRectangle(cornerRadius: JMRadius.md))

                JMButton("Verify & continue", variant: .primary, size: .lg, fullWidth: true) { dismiss() }
            }
            .padding(JMSpace.x5)
        }
        .onAppear { focused = 0 }
    }
}
