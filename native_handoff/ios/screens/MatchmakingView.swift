// MatchmakingView.swift — best 99% match + search list, with a match-detail sheet.
import SwiftUI

struct MatchmakingView: View {
    @EnvironmentObject var app: AppState
    @State private var showDetail = false

    var body: some View {
        ZStack {
            JMColor.surfacePage.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: JMSpace.x5) {
                    JMSectionHeader(title: "Matches",
                        trailing: AnyView(JMBadge("1 new", tone: .pink, soft: true, uppercased: true)))

                    JMCard(variant: .hard) {
                        JMBadge("BEST MATCH YET", tone: .ink, tilt: true)
                        HStack(spacing: JMSpace.x4) {
                            JMProgressRing(value: Double(app.bestMatch.score), size: 104, sublabel: "match")
                            VStack(alignment: .leading, spacing: 8) {
                                JMAvatar(locked: true, size: 44)
                                Text(app.bestMatch.label).font(JMFont.headingSM)
                                HStack(spacing: 4) {
                                    Image(systemName: "mappin.circle.fill").font(.system(size: 13))
                                    Text(app.bestMatch.city).font(JMFont.sans(13))
                                }.foregroundColor(JMColor.textSecondary)
                            }
                            Spacer()
                        }.padding(.top, 6)
                        JMButton("Review match", variant: .primary, fullWidth: true) { showDetail = true }
                            .padding(.top, JMSpace.x4)
                    }

                    Text("SEARCHING FOR A 99% MATCH")
                        .font(JMFont.sans(13, .bold)).tracking(0.6).foregroundColor(JMColor.textTertiary)

                    VStack(spacing: JMSpace.x3) {
                        ForEach(app.prospects) { p in prospectRow(p) }
                    }
                }
                .padding(JMSpace.gutter)
            }
        }
        .sheet(isPresented: $showDetail) {
            MatchDetailSheet(prospect: app.bestMatch).presentationDetents([.large])
        }
    }

    private func prospectRow(_ p: Prospect) -> some View {
        HStack(spacing: JMSpace.x4) {
            JMAvatar(locked: true, size: 48)
            VStack(alignment: .leading, spacing: 2) {
                Text(p.label).font(JMFont.sans(15, .bold))
                HStack(spacing: 4) {
                    Image(systemName: "mappin.circle.fill").font(.system(size: 12))
                    Text(p.city).font(JMFont.sans(12.5))
                }.foregroundColor(JMColor.textTertiary)
            }
            Spacer()
            JMProgressRing(value: Double(p.score), size: 52, thickness: 6)
        }
        .padding(14)
        .background(JMColor.surfaceCard)
        .overlay(RoundedRectangle(cornerRadius: JMRadius.lg).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))
    }
}

struct MatchDetailSheet: View {
    let prospect: Prospect
    @Environment(\.dismiss) private var dismiss

    private let highlights: [(String, String)] = [
        ("moon.stars.fill", "Both practising, family-oriented"),
        ("house.fill", "Wants children in 1–2 years"),
        ("map.fill", "Open to relocating within UK"),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: JMSpace.x4) {
                Capsule().fill(JMColor.ink300).frame(width: 40, height: 5).padding(.top, 8)
                Text("Best match · \(prospect.score)%").font(JMFont.headingMD)
                JMProgressRing(value: Double(prospect.score), size: 130, sublabel: "compatibility")
                JMAvatar(locked: true, size: 56)
                Text("Photos stay private until you both accept. Your wali reviews this match with you.")
                    .font(JMFont.sans(14)).foregroundColor(JMColor.textSecondary)
                    .multilineTextAlignment(.center)

                VStack(spacing: 10) {
                    ForEach(highlights, id: \.0) { h in
                        HStack(spacing: 12) {
                            Image(systemName: h.0).foregroundColor(JMColor.pink500).frame(width: 24)
                            Text(h.1).font(JMFont.sans(14)); Spacer()
                        }
                    }
                }.padding(.vertical, JMSpace.x2)

                HStack(spacing: JMSpace.x3) {
                    JMButton("Not now", variant: .outline, fullWidth: true) { dismiss() }
                    JMButton("Accept & notify wali", variant: .primary, fullWidth: true) { dismiss() }
                }
            }
            .padding(JMSpace.x5)
        }
        .background(JMColor.surfaceCard)
    }
}
