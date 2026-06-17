// Services.swift — explicit service contracts for production wiring boundaries.
import Foundation

enum JMServiceResult {
    case blocked(String)
    case ready(String)

    var message: String {
        switch self {
        case .blocked(let message):
            return message
        case .ready(let message):
            return message
        }
    }
}

protocol AuthService {
    func signOut() -> JMServiceResult
}

protocol VerificationService {
    func verifyPhoneCode(_ code: String) -> JMServiceResult
}

protocol ProfileService {
    func saveQuestionnaireAnswer(section: String, rating: Int) -> JMServiceResult
}

protocol MatchingService {
    func acceptAndNotifyWali(prospect: Prospect) -> JMServiceResult
}

protocol WaliService {
    func inviteDifferentWali() -> JMServiceResult
}

protocol ChatService {
    func startSupervisedVideoCall() -> JMServiceResult
}

protocol NotificationService {
    func openNotifications() -> JMServiceResult
}

struct JustMarriageServices {
    let auth: AuthService
    let verification: VerificationService
    let profile: ProfileService
    let matching: MatchingService
    let wali: WaliService
    let chat: ChatService
    let notifications: NotificationService
}

enum PreviewJustMarriageServices {
    static let current = JustMarriageServices(
        auth: PreviewAuthService(),
        verification: PreviewVerificationService(),
        profile: PreviewProfileService(),
        matching: PreviewMatchingService(),
        wali: PreviewWaliService(),
        chat: PreviewChatService(),
        notifications: PreviewNotificationService()
    )
}

private struct PreviewAuthService: AuthService {
    func signOut() -> JMServiceResult {
        .blocked("Sign out is blocked until the auth service boundary is wired.")
    }
}

private struct PreviewVerificationService: VerificationService {
    func verifyPhoneCode(_ code: String) -> JMServiceResult {
        .blocked("Verification service is not connected yet. Code entry is ready for the secure provider integration.")
    }
}

private struct PreviewProfileService: ProfileService {
    func saveQuestionnaireAnswer(section: String, rating: Int) -> JMServiceResult {
        .ready("Saved locally. The next profile section is available when the profile service syncs.")
    }
}

private struct PreviewMatchingService: MatchingService {
    func acceptAndNotifyWali(prospect: Prospect) -> JMServiceResult {
        .blocked("Wali notification service is required before this acceptance can be sent.")
    }
}

private struct PreviewWaliService: WaliService {
    func inviteDifferentWali() -> JMServiceResult {
        .blocked("Alternative wali invite is blocked until contact-service wiring is available. Yusuf remains the active wali.")
    }
}

private struct PreviewChatService: ChatService {
    func startSupervisedVideoCall() -> JMServiceResult {
        .blocked("Supervised video calls require wali scheduling service wiring.")
    }
}

private struct PreviewNotificationService: NotificationService {
    func openNotifications() -> JMServiceResult {
        .blocked("Notifications require push-service wiring before production.")
    }
}
