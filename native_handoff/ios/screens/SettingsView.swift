// SettingsView.swift — profile summary + preference toggles (SwiftUI).
import SwiftUI

struct SettingsView: View {
    @State private var matchNotif = true
    @State private var notifyWali = true
    @State private var hidePhoto = false

    var body: some View {
        ZStack {
            JMColor.surfacePage.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: JMSpace.x5) {
                    JMSectionHeader(title: "Settings")

                    HStack(spacing: JMSpace.x4) {
                        JMAvatar(initials: "AB", size: 60)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Aisha B.").font(JMFont.headingSM)
                            JMBadge("Identity verified", tone: .success, soft: true)
                        }
                    }

                    VStack(spacing: 0) {
                        toggleRow("bell.fill", "Match notifications", $matchNotif)
                        divider
                        toggleRow("shield.lefthalf.filled", "Notify my wali", $notifyWali)
                        divider
                        toggleRow("eye.slash.fill", "Hide my photo until match", $hidePhoto)
                        divider
                        HStack(spacing: 14) {
                            Image(systemName: "globe").foregroundColor(JMColor.ink500).frame(width: 22)
                            Text("Language").font(JMFont.sans(14.5, .semibold))
                            Spacer()
                            Text("English ›").font(JMFont.sans(14)).foregroundColor(JMColor.textTertiary)
                        }.padding(14)
                    }
                    .background(JMColor.surfaceCard)
                    .overlay(RoundedRectangle(cornerRadius: JMRadius.lg).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))

                    JMButton("Sign out", variant: .outline, fullWidth: true, systemIcon: "rectangle.portrait.and.arrow.right") {}
                }
                .padding(JMSpace.gutter)
            }
        }
    }

    private var divider: some View { Rectangle().fill(JMColor.ink100).frame(height: 1) }

    private func toggleRow(_ icon: String, _ label: String, _ binding: Binding<Bool>) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon).foregroundColor(JMColor.ink500).frame(width: 22)
            Text(label).font(JMFont.sans(14.5, .semibold))
            Spacer()
            Toggle("", isOn: binding).labelsHidden().tint(JMColor.pink500)
        }.padding(14)
    }
}
