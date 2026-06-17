// ProfileQuestionnaireView.swift — sections + the 1–10 importance scale (SwiftUI).
import SwiftUI

struct ProfileQuestionnaireView: View {
    @State private var rating: Int? = 8
    @State private var savedNotice: String? = nil
    private let sections: [(String, String)] = [
        ("Personal & family background", "done"),
        ("Religious understanding", "done"),
        ("Roles & responsibilities", "active"),
        ("Children & future plans", "todo"),
        ("Finances & lifestyle", "todo"),
    ]

    var body: some View {
        ZStack {
            JMColor.surfacePage.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: JMSpace.x5) {
                    JMSectionHeader(title: "Profile")

                    // Progress
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("62% complete").font(JMFont.sans(13, .bold))
                            Spacer()
                            Text("10 of 16 sections").font(JMFont.sans(13)).foregroundColor(JMColor.textTertiary)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(JMColor.ink100)
                                Capsule().fill(LinearGradient(colors: [JMColor.pink500, JMColor.cyanBright],
                                    startPoint: .leading, endPoint: .trailing))
                                    .frame(width: geo.size.width * 0.62)
                            }
                        }.frame(height: 10)
                    }
                    .padding(JMSpace.x4)
                    .background(JMColor.surfaceCard)
                    .overlay(RoundedRectangle(cornerRadius: JMRadius.lg).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
                    .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))

                    // Current question
                    JMCard(variant: .tinted, tint: JMColor.pink50) {
                        Text("ROLES & RESPONSIBILITIES").font(JMFont.sans(12, .bold))
                            .tracking(0.5).foregroundColor(JMColor.pink700)
                        Text("How important is it that household responsibilities follow Islamic guidance?")
                            .font(JMFont.sans(17, .bold)).padding(.vertical, 4)
                        JMScaleRating(value: $rating, lowLabel: "Flexible", highLabel: "Essential")
                            .onChange(of: rating) { _ in savedNotice = nil }
                        if let savedNotice {
                            JMBadge(savedNotice, tone: .success, soft: true)
                                .padding(.top, JMSpace.x2)
                        }
                        JMButton("Save & continue", variant: .ink, fullWidth: true, systemIcon: "arrow.right") {
                            guard let rating else { return }
                            savedNotice = PreviewJustMarriageServices.current.profile
                                .saveQuestionnaireAnswer(section: "roles_responsibilities", rating: rating)
                                .message
                        }
                        .disabled(rating == nil)
                        .opacity(rating == nil ? 0.55 : 1)
                        .padding(.top, JMSpace.x3)
                    }

                    Text("SECTIONS").font(JMFont.sans(13, .bold)).tracking(0.6).foregroundColor(JMColor.textTertiary)
                    VStack(spacing: JMSpace.x2) {
                        ForEach(sections, id: \.0) { s in sectionRow(s.0, s.1) }
                    }
                }
                .padding(JMSpace.gutter)
            }
        }
    }

    private func sectionRow(_ title: String, _ state: String) -> some View {
        let active = state == "active"; let done = state == "done"
        return HStack(spacing: 12) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 22))
                .foregroundColor(done ? JMColor.green500 : active ? JMColor.pink500 : JMColor.ink300)
            Text(title).font(JMFont.sans(14.5, .semibold))
                .foregroundColor(done || active ? JMColor.ink900 : JMColor.textTertiary)
            Spacer()
            if active { JMBadge("Now", tone: .pink, soft: true) }
        }
        .padding(.vertical, 12).padding(.horizontal, 14)
        .background(JMColor.surfaceCard)
        .overlay(RoundedRectangle(cornerRadius: JMRadius.md)
            .strokeBorder(active ? JMColor.pink500 : JMColor.borderSubtle, lineWidth: 1.5))
        .clipShape(RoundedRectangle(cornerRadius: JMRadius.md))
    }
}
