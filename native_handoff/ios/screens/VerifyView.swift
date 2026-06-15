// VerifyView.swift — phone OTP entry (SwiftUI).
import SwiftUI

struct VerifyView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var code: [String] = ["", "", "", ""]
    @State private var validationMessage: String? = nil
    @FocusState private var focused: Int?

    private var hasAllDigits: Bool { code.allSatisfy { $0.count == 1 } }

    var body: some View {
        ZStack {
            JMColor.surfacePage.ignoresSafeArea()
            VStack(alignment: .leading, spacing: JMSpace.x4) {
                HStack {
                    Text("VERIFICATION")
                        .font(JMFont.display(34))
                        .foregroundColor(JMColor.ink900)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(JMColor.ink700)
                            .frame(width: 38, height: 38)
                            .background(JMColor.ink100).clipShape(Circle())
                    }
                }

                JMBadge("STEP 1 OF 2 · PHONE", tone: .pink, soft: true, uppercased: true)
                    .padding(.top, JMSpace.x2)
                Text("Verify your phone").font(JMFont.headingLG)
                Text("Enter the 4-digit code we sent to +44 7•• ••• 204")
                    .font(JMFont.sans(15))
                    .foregroundColor(JMColor.textSecondary)
                    .lineSpacing(3)

                HStack(spacing: 12) {
                    ForEach(0..<4) { i in otpBox(i) }
                }
                .padding(.vertical, JMSpace.x5)

                JMButton("Verify & continue", variant: .primary, size: .lg, pill: true, fullWidth: true) {
                    verifyCode()
                }

                VStack(spacing: 6) {
                    Text("Resend code in 0:29")
                        .font(JMFont.sans(14, .semibold))
                        .foregroundColor(JMColor.textTertiary)
                    if let validationMessage {
                        Text(validationMessage)
                            .font(JMFont.sans(12, .semibold))
                            .foregroundColor(validationMessage.contains("not connected") ? JMColor.textSecondary : JMColor.error)
                    }
                }
                .frame(maxWidth: .infinity)

                Spacer()

                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 22))
                        .foregroundColor(JMColor.cyan700)
                    Text("Your number stays private. Matches only see that you are verified.")
                        .font(JMFont.sans(13, .semibold))
                        .foregroundColor(JMColor.cyan900)
                        .lineSpacing(3)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(JMColor.cyan50)
                .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))
            }
            .padding(JMSpace.x5)
        }
        .onAppear { focused = 0 }
    }

    private func otpBox(_ i: Int) -> some View {
        let filled = !code[i].isEmpty
        let active = filled || focused == i
        return TextField("", text: $code[i])
            .keyboardType(.numberPad)
            .multilineTextAlignment(.center)
            .font(JMFont.display(30))
            .foregroundColor(active ? JMColor.white : JMColor.ink900)
            .frame(height: 64)
            .frame(maxWidth: .infinity)
            .background(active ? JMColor.pink500 : JMColor.surfaceCard)
            .overlay(RoundedRectangle(cornerRadius: JMRadius.md)
                .strokeBorder(active ? JMColor.pink500 : JMColor.ink200, lineWidth: 2))
            .clipShape(RoundedRectangle(cornerRadius: JMRadius.md))
            .focused($focused, equals: i)
            .onChange(of: code[i]) { value in
                let digit = value.filter { $0.isNumber }.prefix(1)
                code[i] = String(digit)
                validationMessage = nil
                if !digit.isEmpty && i < 3 { focused = i + 1 }
            }
    }

    private func verifyCode() {
        guard hasAllDigits else {
            validationMessage = "Enter all 4 digits before continuing."
            return
        }
        validationMessage = "Verification service is not connected yet."
    }
}
