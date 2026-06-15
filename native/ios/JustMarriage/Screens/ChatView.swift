// ChatView.swift — wali-supervised post-match conversation (SwiftUI).
import SwiftUI

struct ChatView: View {
    @Environment(\.dismiss) private var dismiss
    struct Msg: Identifiable { let id = UUID(); let me: Bool; let text: String }
    @State private var draft = ""
    @State private var videoNotice: String? = nil
    @State private var msgs: [Msg] = [
        .init(me: false, text: "Assalamu alaikum — our walis have connected us. Looking forward to getting to know your family."),
        .init(me: true, text: "Wa alaikum assalam. Likewise, alhamdulillah."),
        .init(me: false, text: "Shall we set a supervised call this weekend?"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            header
            thread
            composer
        }
        .background(JMColor.white.ignoresSafeArea())
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button { dismiss() } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(JMColor.ink700)
                    .frame(width: 34, height: 34)
            }
            .buttonStyle(.plain)
            JMAvatar(initials: "A", size: 42)
            VStack(alignment: .leading, spacing: 3) {
                Text("Matched · 99%").font(JMFont.sans(15, .bold))
                JMBadge("Wali-supervised", tone: .success, soft: true)
            }
            Spacer()
            Button {
                videoNotice = PreviewJustMarriageServices.current.chat.startSupervisedVideoCall().message
            } label: {
                Image(systemName: "video.fill")
                    .foregroundColor(.white)
                    .frame(width: 42, height: 42)
                    .background(JMColor.pink500)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(JMColor.surfaceCard)
        .overlay(Rectangle().fill(JMColor.ink100).frame(height: 1), alignment: .bottom)
    }

    private var thread: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("Both walis are in this conversation")
                    .font(JMFont.sans(12, .semibold))
                    .foregroundColor(JMColor.textTertiary)
                    .padding(.vertical, 6).padding(.horizontal, 13)
                    .background(JMColor.ink100)
                    .clipShape(Capsule())
                    .padding(.bottom, 6)
                if let videoNotice {
                    Text(videoNotice)
                        .font(JMFont.sans(12.5, .semibold))
                        .foregroundColor(JMColor.textSecondary)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(JMColor.amber50)
                        .clipShape(RoundedRectangle(cornerRadius: JMRadius.md))
                }
                ForEach(msgs) { m in bubble(m) }
            }
            .padding(18)
        }
        .background(JMColor.white)
    }

    private func bubble(_ m: Msg) -> some View {
        HStack {
            if m.me { Spacer(minLength: 50) }
            Text(m.text)
                .font(JMFont.sans(14.5))
                .lineSpacing(2)
                .foregroundColor(m.me ? .white : JMColor.ink900)
                .padding(.vertical, 10)
                .padding(.horizontal, 14)
                .background(m.me ? JMColor.pink500 : JMColor.surfaceCard)
                .overlay(m.me ? nil : RoundedRectangle(cornerRadius: 18).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 18))
            if !m.me { Spacer(minLength: 50) }
        }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("", text: $draft, prompt: Text("Write a message…").foregroundColor(JMColor.textTertiary))
                .font(JMFont.sans(14))
                .foregroundColor(JMColor.ink900)
                .padding(.vertical, 11)
                .padding(.horizontal, 16)
                .background(JMColor.ink100)
                .clipShape(Capsule())
            Button(action: send) {
                Image(systemName: "paperplane.fill")
                    .foregroundColor(.white)
                    .frame(width: 40, height: 40)
                    .background(JMColor.pink500)
                    .clipShape(Circle())
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.55 : 1)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(JMColor.surfaceCard)
        .overlay(Rectangle().fill(JMColor.ink100).frame(height: 1), alignment: .top)
    }

    private func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        msgs.append(.init(me: true, text: text))
        draft = ""
    }
}
