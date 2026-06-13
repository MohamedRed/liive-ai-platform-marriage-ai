// MatchmakingView.swift — best 99% match + search list, with a match-detail sheet.
import SwiftUI

struct MatchmakingView: View {
    @EnvironmentObject var app: AppState
    @State private var showDetail = false

    var body: some View {
        ZStack(alignment: .bottom) {
            JMColor.surfacePage.ignoresSafeArea()
            content
                .blur(radius: showDetail ? 4 : 0)
                .disabled(showDetail)
            if showDetail { detailOverlay }
        }
        .animation(JMMotion.easeOut, value: showDetail)
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: JMSpace.x5) {
                JMSectionHeader(title: "Matches",
                    trailing: AnyView(JMBadge("1 NEW", tone: .pink, soft: true, uppercased: true)))

                JMCard(variant: .hard) {
                    JMBadge("BEST MATCH YET", tone: .ink, tilt: true)
                    HStack(spacing: JMSpace.x4) {
                        JMProgressRing(value: Double(app.bestMatch.score), size: 104, sublabel: "match")
                        VStack(alignment: .leading, spacing: 8) {
                            JMAvatar(locked: true, size: 48)
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
                    ForEach(app.prospects.prefix(2)) { p in prospectRow(p) }
                }
            }
            .padding(JMSpace.gutter)
        }
    }

    private var detailOverlay: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.26)
                .ignoresSafeArea()
                .onTapGesture { showDetail = false }
            MatchDetailSheet(prospect: app.bestMatch, serviceNoticeVisible: $app.matchAcceptanceNeedsWaliService) {
                showDetail = false
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
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
    @Binding var serviceNoticeVisible: Bool
    let onClose: () -> Void

    private let highlights: [(String, String)] = [
        ("moon.stars.fill", "Both practising, family-oriented"),
        ("house.fill", "Wants children in 1–2 years"),
        ("map.fill", "Open to relocating within UK"),
    ]
    private let waliNotificationAvailable = false

    var body: some View {
        VStack(spacing: JMSpace.x4) {
            HStack {
                Capsule().fill(JMColor.ink300).frame(width: 42, height: 5)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(JMColor.ink600)
                        .frame(width: 34, height: 34)
                        .background(JMColor.ink100)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }

            Text("Best match · \(prospect.score)%").font(JMFont.headingMD)
            JMProgressRing(value: Double(prospect.score), size: 130, sublabel: "compatibility")
            JMAvatar(locked: true, size: 58)
            Text("Photos stay private until you both accept. Your wali reviews this match with you.")
                .font(JMFont.sans(14))
                .foregroundColor(JMColor.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(3)

            VStack(spacing: 10) {
                ForEach(highlights, id: \.0) { h in
                    HStack(spacing: 12) {
                        Image(systemName: h.0).foregroundColor(JMColor.pink500).frame(width: 24)
                        Text(h.1).font(JMFont.sans(14, .semibold))
                        Spacer()
                    }
                }
            }
            .padding(.vertical, JMSpace.x2)

            if !waliNotificationAvailable {
                Text("Wali notification service is required before this acceptance can be sent.")
                    .font(JMFont.sans(13, .semibold))
                    .foregroundColor(JMColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(12)
                    .frame(maxWidth: .infinity)
                    .background(JMColor.ink100)
                    .clipShape(RoundedRectangle(cornerRadius: JMRadius.md))
            } else if serviceNoticeVisible {
                Text("Acceptance is ready, but wali notification service is not connected yet.")
                    .font(JMFont.sans(13, .semibold))
                    .foregroundColor(JMColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(12)
                    .frame(maxWidth: .infinity)
                    .background(JMColor.ink100)
                    .clipShape(RoundedRectangle(cornerRadius: JMRadius.md))
            }

            HStack(spacing: JMSpace.x3) {
                JMButton("Not now", variant: .outline, fullWidth: true) { onClose() }
                JMButton("Accept & notify wali",
                         variant: .primary, fullWidth: true) {
                    serviceNoticeVisible = true
                }
                .disabled(!waliNotificationAvailable)
                .opacity(waliNotificationAvailable ? 1 : 0.55)
            }
        }
        .padding(JMSpace.x5)
        .padding(.bottom, JMSpace.x2)
        .frame(maxWidth: .infinity)
        .background(JMColor.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .ignoresSafeArea(edges: .bottom)
    }
}
