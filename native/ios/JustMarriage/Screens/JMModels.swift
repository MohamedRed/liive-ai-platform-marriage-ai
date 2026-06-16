// JMModels.swift — mock data + shared types for the Just Marriage screens.
import SwiftUI

struct Prospect: Identifiable {
    let id = UUID()
    let label: String      // e.g. "Sister · 27"
    let city: String       // e.g. "London, UK"
    let score: Int         // compatibility 0–100
}

enum AppTab: Hashable { case talk, matches, profile, wali, settings }

/// Lightweight app-wide state for the demo (navigation + sample data).
final class AppState: ObservableObject {
    @Published var tab: AppTab
    @Published var onboarded: Bool
    @Published var matchAcceptanceNeedsWaliService = false

    let bestMatch = Prospect(label: "Sister · 27", city: "London, UK", score: 99)
    let prospects = [
        Prospect(label: "Sister · 25", city: "Manchester", score: 91),
        Prospect(label: "Sister · 29", city: "Birmingham", score: 88),
        Prospect(label: "Sister · 26", city: "Leeds", score: 84),
    ]

    init(initialTab: AppTab = .talk, onboarded: Bool = false) {
        self.tab = initialTab
        self.onboarded = onboarded
    }
}

// Small reusable section header (Anton, uppercase).
struct JMSectionHeader: View {
    let title: String
    var trailing: AnyView? = nil
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title.uppercased())
                .font(JMFont.display(30))
                .foregroundColor(JMColor.ink900)
            Spacer()
            if let t = trailing { t }
        }
    }
}

struct JMBrandWordmark: View {
    var compact = false
    var body: some View {
        HStack(spacing: compact ? 5 : 6) {
            Text("JUST").font(JMFont.display(compact ? 22 : 34)).foregroundColor(.white)
            Text("MARRIAGE")
                .font(JMFont.display(compact ? 18 : 28))
                .foregroundColor(JMColor.pink500)
                .padding(.horizontal, compact ? 6 : 8)
                .padding(.vertical, compact ? 1 : 2)
                .background(JMColor.cyanBright)
                .clipShape(RoundedRectangle(cornerRadius: compact ? 5 : 7))
        }
    }
}
