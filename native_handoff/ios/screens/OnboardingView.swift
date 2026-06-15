// OnboardingView.swift — intent + brother/sister selection (SwiftUI).
import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var app: AppState
    @State private var role: String? = nil

    var body: some View {
        ZStack {
            JMColor.ink900.ignoresSafeArea()
            VStack(alignment: .leading, spacing: JMSpace.x6) {
                // Wordmark
                HStack(spacing: 6) {
                    Text("JUST").font(JMFont.display(34)).foregroundColor(.white)
                    Text("MARRIAGE").font(JMFont.display(28)).foregroundColor(JMColor.pink500)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(JMColor.cyanBright).clipShape(RoundedRectangle(cornerRadius: 7))
                }

                Spacer()

                VStack(alignment: .leading, spacing: JMSpace.x5) {
                    (Text("No swap.\nNo chat.\n") + Text("No date."))
                        .font(JMFont.display(46))
                        .foregroundColor(.white)
                        .lineSpacing(-6)
                        .textCase(.uppercase)

                    Text("A calm, guided path to marriage — led by an AI counselor, kept halal by your wali.")
                        .font(JMFont.sans(16))
                        .foregroundColor(.white.opacity(0.85))
                        .lineSpacing(6)

                    VStack(alignment: .leading, spacing: JMSpace.x3) {
                        Text("I AM A…").font(JMFont.sans(13, .bold))
                            .tracking(0.6).foregroundColor(.white.opacity(0.7))
                        HStack(spacing: JMSpace.x3) {
                            roleCard("brother", "Brother", "person.fill")
                            roleCard("sister", "Sister", "person.fill")
                        }
                    }
                }

                Spacer()

                JMButton("Create my profile", variant: .primary, size: .lg, pill: true, fullWidth: true,
                         systemIcon: "arrow.right") {
                    withAnimation { app.onboarded = true }
                }
                .opacity(role == nil ? 0.5 : 1)
                .disabled(role == nil)

                HStack { Spacer()
                    Text("Already a member? ").foregroundColor(.white.opacity(0.6))
                    + Text("Sign in").foregroundColor(JMColor.cyanBright).bold()
                    Spacer() }
                    .font(JMFont.sans(13))
            }
            .padding(JMSpace.x6)
        }
    }

    private func roleCard(_ id: String, _ label: String, _ icon: String) -> some View {
        Button { role = id } label: {
            VStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 26))
                Text(label).font(JMFont.sans(15, .bold))
            }
            .frame(maxWidth: .infinity).padding(.vertical, 18)
            .background(role == id ? JMColor.pink500 : Color.white.opacity(0.08))
            .foregroundColor(.white)
            .overlay(RoundedRectangle(cornerRadius: JMRadius.lg)
                .strokeBorder(role == id ? JMColor.pink500 : .clear, lineWidth: 2))
            .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))
        }.buttonStyle(.plain)
    }
}
