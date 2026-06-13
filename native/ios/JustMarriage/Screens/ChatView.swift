// ChatView.swift — wali-supervised post-match conversation (SwiftUI).
import SwiftUI

struct ChatView: View {
    @Environment(\.dismiss) private var dismiss
    struct Msg: Identifiable { let id = UUID(); let me: Bool; let text: String }
    @State private var draft = ""
    private let msgs: [Msg] = [
        .init(me: false, text: "Assalamu alaikum — our walis have connected us. Looking forward to getting to know your family."),
        .init(me: true, text: "Wa alaikum assalam. Likewise, alhamdulillah."),
        .init(me: false, text: "Shall we set a supervised call this weekend?"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 12) {
                Button { dismiss() } label: { Image(systemName: "arrow.left").foregroundColor(JMColor.ink700) }
                JMAvatar(initials: "A", size: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Matched · 99%").font(JMFont.sans(15, .bold))
                    Text("Wali-supervised").font(JMFont.sans(12, .semibold)).foregroundColor(JMColor.green500)
                }
                Spacer()
                Image(systemName: "video.fill").foregroundColor(JMColor.pink500)
                    .frame(width: 40, height: 40).background(JMColor.pink50).clipShape(Circle())
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(JMColor.surfaceCard)
            .overlay(Rectangle().fill(JMColor.ink100).frame(height: 1), alignment: .bottom)

            // Thread
            ScrollView {
                VStack(spacing: 10) {
                    Text("Both walis are in this conversation")
                        .font(JMFont.sans(12)).foregroundColor(JMColor.textTertiary)
                        .padding(.vertical, 5).padding(.horizontal, 12)
                        .background(JMColor.ink100).clipShape(Capsule())
                    ForEach(msgs) { m in
                        HStack {
                            if m.me { Spacer(minLength: 50) }
                            Text(m.text).font(JMFont.sans(14.5)).lineSpacing(2)
                                .foregroundColor(m.me ? .white : JMColor.ink900)
                                .padding(.vertical, 10).padding(.horizontal, 14)
                                .background(m.me ? JMColor.pink500 : JMColor.surfaceCard)
                                .overlay(m.me ? nil : RoundedRectangle(cornerRadius: 18).strokeBorder(JMColor.borderSubtle, lineWidth: 1))
                                .clipShape(RoundedRectangle(cornerRadius: 18))
                            if !m.me { Spacer(minLength: 50) }
                        }
                    }
                }.padding(18)
            }
            .background(JMColor.surfacePage)

            // Composer
            HStack(spacing: 10) {
                Text(draft.isEmpty ? "Write a message…" : draft)
                    .font(JMFont.sans(14)).foregroundColor(JMColor.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 11).padding(.horizontal, 16)
                    .background(JMColor.ink100).clipShape(Capsule())
                Image(systemName: "paperplane.fill").foregroundColor(.white)
                    .frame(width: 40, height: 40).background(JMColor.pink500).clipShape(Circle())
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(JMColor.surfaceCard)
            .overlay(Rectangle().fill(JMColor.ink100).frame(height: 1), alignment: .top)
        }
        .background(JMColor.surfacePage.ignoresSafeArea())
    }
}
