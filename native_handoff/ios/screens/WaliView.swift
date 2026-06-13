// WaliView.swift — guardian explainer + verification stepper (SwiftUI).
import SwiftUI

struct WaliView: View {
    @State private var showVerify = false

    var body: some View {
        ZStack {
            JMColor.surfacePage.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: JMSpace.x5) {
                    JMSectionHeader(title: "Wali")

                    JMCard(variant: .tinted, tint: JMColor.cyan50) {
                        Image(systemName: "shield.lefthalf.filled").font(.system(size: 28)).foregroundColor(JMColor.cyan700)
                        Text("Your wali guides the process").font(JMFont.sans(17, .bold)).padding(.top, 4)
                        Text("A trusted guardian who reviews matches with you and is notified at every step — keeping everything halal.")
                            .font(JMFont.sans(14)).foregroundColor(JMColor.cyan900).lineSpacing(3)
                    }

                    // Stepper
                    HStack(alignment: .top, spacing: 0) {
                        step("Phone", "phone.fill", .done)
                        connector(.done)
                        step("Identity", "person.text.rectangle.fill", .active)
                        connector(.todo)
                        step("Confirm", "checkmark.seal.fill", .todo)
                    }
                    .padding(.vertical, 18).padding(.horizontal, 14)
                    .background(JMColor.surfaceCard)
                    .overlay(RoundedRectangle(cornerRadius: JMRadius.lg).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))

                    // Wali card
                    HStack(spacing: JMSpace.x4) {
                        JMAvatar(initials: "YB", size: 48, tint: JMColor.ink200)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Yusuf (Father)").font(JMFont.sans(15, .bold))
                            Text("+44 7•• ••• 204").font(JMFont.sans(13)).foregroundColor(JMColor.textTertiary)
                        }
                        Spacer()
                        JMBadge("Verifying", tone: .warning, soft: true)
                    }
                    .padding(14).background(JMColor.surfaceCard)
                    .overlay(RoundedRectangle(cornerRadius: JMRadius.lg).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))

                    JMButton("Continue verification", variant: .primary, fullWidth: true, systemIcon: "person.text.rectangle.fill") {
                        showVerify = true
                    }
                    JMButton("Invite a different wali", variant: .ghost, fullWidth: true, systemIcon: "person.badge.plus") {}
                }
                .padding(JMSpace.gutter)
            }
        }
        .sheet(isPresented: $showVerify) { VerifyView().presentationDetents([.large]) }
    }

    enum StepState { case done, active, todo }

    private func step(_ label: String, _ icon: String, _ state: StepState) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().fill(state == .done ? JMColor.green500 : state == .active ? JMColor.pink500 : JMColor.white)
                    .frame(width: 40, height: 40)
                if state == .todo {
                    Circle().strokeBorder(JMColor.ink200, lineWidth: 1.5).frame(width: 40, height: 40)
                }
                Image(systemName: state == .done ? "checkmark" : icon)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(state == .todo ? JMColor.ink400 : .white)
            }
            Text(label).font(JMFont.sans(11, .semibold))
                .foregroundColor(state == .todo ? JMColor.textTertiary : JMColor.ink900)
        }.frame(maxWidth: .infinity)
    }

    private func connector(_ state: StepState) -> some View {
        Rectangle().fill(state == .done ? JMColor.green500 : JMColor.ink200)
            .frame(height: 2).padding(.top, 19)
    }
}
