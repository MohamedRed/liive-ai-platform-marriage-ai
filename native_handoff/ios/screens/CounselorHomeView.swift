// CounselorHomeView.swift — voice-first home with a Talk / Type toggle (SwiftUI).
import SwiftUI

struct CounselorHomeView: View {
    @EnvironmentObject var app: AppState
    enum Mode { case voice, text }
    @State private var mode: Mode = .voice
    @State private var connected = true

    var body: some View {
        ZStack {
            JMColor.ink900.ignoresSafeArea()
            VStack(spacing: JMSpace.x4) {
                header
                toggle
                if mode == .voice { voiceBody } else { TextCounselView() }
            }
            .padding(JMSpace.x5)
        }
    }

    private var header: some View {
        HStack {
            HStack(spacing: 5) {
                Text("JUST").font(JMFont.display(22)).foregroundColor(.white)
                Text("MARRIAGE").font(JMFont.display(18)).foregroundColor(JMColor.pink500)
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(JMColor.cyanBright).clipShape(RoundedRectangle(cornerRadius: 5))
            }
            Spacer()
            Image(systemName: "bell.fill").foregroundColor(.white.opacity(0.8))
        }
    }

    private var toggle: some View {
        HStack(spacing: 4) {
            toggleButton("Talk", "mic.fill", .voice)
            toggleButton("Type", "bubble.left.fill", .text)
        }
        .padding(4)
        .background(Color.white.opacity(0.1))
        .clipShape(Capsule())
    }

    private func toggleButton(_ label: String, _ icon: String, _ m: Mode) -> some View {
        Button { withAnimation(JMMotion.easeOut) { mode = m } } label: {
            HStack(spacing: 6) { Image(systemName: icon); Text(label) }
                .font(JMFont.sans(13, .bold))
                .padding(.vertical, 7).padding(.horizontal, 16)
                .background(mode == m ? Color.white : .clear)
                .foregroundColor(mode == m ? JMColor.ink900 : .white.opacity(0.75))
                .clipShape(Capsule())
        }.buttonStyle(.plain)
    }

    private var voiceBody: some View {
        VStack(spacing: JMSpace.x6) {
            Spacer()
            JMBadge("AI marriage counselor", tone: .cyan, uppercased: true)
            ZStack {
                Circle()
                    .fill(RadialGradient(colors: [JMColor.pink500.opacity(0.35), JMColor.cyanBright.opacity(0.12), .clear],
                                         center: .center, startRadius: 6, endRadius: 90))
                    .frame(width: 150, height: 150)
                JMVoiceBars(active: connected, tint: JMColor.pink500, height: 64).frame(width: 110)
            }
            Text(connected ? "“What matters most to you in a spouse?”" : "Tap to start your session")
                .font(JMFont.sans(19, .semibold)).foregroundColor(.white)
                .multilineTextAlignment(.center).frame(maxWidth: 300, minHeight: 56)
            if connected {
                Button { connected = false } label: {
                    HStack(spacing: 8) { Image(systemName: "mic.fill"); Text("End session") }
                        .font(JMFont.sans(14, .bold)).foregroundColor(.white)
                        .padding(.vertical, 10).padding(.horizontal, 22)
                        .overlay(Capsule().strokeBorder(Color.white.opacity(0.3), lineWidth: 1.5))
                }.buttonStyle(.plain)
            } else {
                JMButton("Start talking", variant: .primary, size: .lg, pill: true, systemIcon: "mic.fill") { connected = true }
            }
            Spacer()
            HStack(spacing: JMSpace.x3) {
                shortcut("heart.fill", "Matches", "1 new") { app.tab = .matches }
                shortcut("person.fill", "Profile", "62%") { app.tab = .profile }
            }
        }
    }

    private func shortcut(_ icon: String, _ label: String, _ sub: String, _ tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 22)).foregroundColor(JMColor.cyanBright)
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(JMFont.sans(15, .bold)).foregroundColor(.white)
                    Text(sub).font(JMFont.sans(12)).foregroundColor(.white.opacity(0.7))
                }
                Spacer()
            }
            .padding(14).frame(maxWidth: .infinity)
            .background(Color.white.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: JMRadius.lg))
        }.buttonStyle(.plain)
    }
}

// Text conversation with the counselor.
struct TextCounselView: View {
    struct Msg: Identifiable { let id = UUID(); let me: Bool; let text: String }
    @State private var thread: [Msg] = [
        .init(me: false, text: "Assalamu alaikum. Let's pick up where we left off — what matters most to you in a future spouse?")
    ]
    @State private var draft = ""
    @State private var typing = false
    private let replies = [
        "Thank you for sharing that. How important is it that they share your level of religious practice?",
        "Understood. And how do you both imagine sharing responsibilities at home, in light of Islamic guidance?",
        "That's helpful. When you picture family life, where do children fit into your plans?",
    ]
    @State private var ri = 0

    var body: some View {
        VStack(spacing: JMSpace.x3) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(thread) { m in bubble(m).id(m.id) }
                        if typing { typingDots }
                    }.padding(.vertical, 8)
                }
                .onChange(of: thread.count) { _ in
                    if let last = thread.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                }
            }
            composer
        }
    }

    private func bubble(_ m: Msg) -> some View {
        HStack {
            if m.me { Spacer(minLength: 40) }
            VStack(alignment: m.me ? .trailing : .leading, spacing: 4) {
                if !m.me {
                    HStack(spacing: 6) { Image(systemName: "sparkles"); Text("COUNSELOR") }
                        .font(JMFont.sans(11, .bold)).tracking(0.5).foregroundColor(.white.opacity(0.55))
                }
                Text(m.text).font(JMFont.sans(14.5)).foregroundColor(.white).lineSpacing(3)
                    .padding(.vertical, 11).padding(.horizontal, 15)
                    .background(m.me ? JMColor.pink500 : Color.white.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            if !m.me { Spacer(minLength: 40) }
        }
    }

    private var typingDots: some View {
        HStack(spacing: 5) { ForEach(0..<3) { _ in Circle().fill(JMColor.cyanBright).frame(width: 7, height: 7) } }
            .padding(12).background(Color.white.opacity(0.1)).clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var composer: some View {
        HStack(spacing: 8) {
            TextField("", text: $draft, prompt: Text("Write your answer…").foregroundColor(.white.opacity(0.5)))
                .foregroundColor(.white).font(JMFont.sans(14.5)).padding(.leading, 16)
            Image(systemName: "mic.fill").foregroundColor(.white.opacity(0.6))
            Button(action: send) {
                Image(systemName: "paperplane.fill").foregroundColor(.white)
                    .frame(width: 40, height: 40).background(JMColor.pink500).clipShape(Circle())
            }
        }
        .padding(5).background(Color.white.opacity(0.12)).clipShape(Capsule())
    }

    private func send() {
        let t = draft.trimmingCharacters(in: .whitespaces); guard !t.isEmpty else { return }
        thread.append(.init(me: true, text: t)); draft = ""; typing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            thread.append(.init(me: false, text: replies[ri % replies.count])); ri += 1; typing = false
        }
    }
}
