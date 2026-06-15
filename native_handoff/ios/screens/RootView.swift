// RootView.swift — tab navigation + onboarding gate for Just Marriage (SwiftUI).
import SwiftUI

struct RootView: View {
    @StateObject private var app = AppState()

    var body: some View {
        ZStack {
            TabView(selection: $app.tab) {
                CounselorHomeView().tag(AppTab.talk)
                    .tabItem { Label("Talk", systemImage: "mic.fill") }
                MatchmakingView().tag(AppTab.matches)
                    .tabItem { Label("Matches", systemImage: "heart.fill") }
                ProfileQuestionnaireView().tag(AppTab.profile)
                    .tabItem { Label("Profile", systemImage: "person.fill") }
                WaliView().tag(AppTab.wali)
                    .tabItem { Label("Wali", systemImage: "shield.lefthalf.filled") }
                SettingsView().tag(AppTab.settings)
                    .tabItem { Label("Settings", systemImage: "gearshape.fill") }
            }
            .tint(JMColor.primary)
            .environmentObject(app)

            if !app.onboarded {
                OnboardingView().environmentObject(app)
                    .transition(.move(edge: .trailing))
                    .zIndex(2)
            }
        }
        .animation(JMMotion.easeOut, value: app.onboarded)
    }
}

#Preview { RootView() }
