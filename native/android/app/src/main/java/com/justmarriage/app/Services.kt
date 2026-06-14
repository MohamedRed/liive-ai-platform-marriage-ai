// Services.kt — explicit service contracts for production wiring boundaries.
package com.justmarriage.app

sealed interface JMServiceResult {
    data class Blocked(val message: String) : JMServiceResult
    data class Ready(val message: String) : JMServiceResult
}

interface AuthService {
    fun signOut(): JMServiceResult
}

interface VerificationService {
    fun verifyPhoneCode(code: String): JMServiceResult
}

interface ProfileService {
    fun saveQuestionnaireAnswer(section: String, rating: Int): JMServiceResult
}

interface MatchingService {
    val canNotifyWali: Boolean
    fun acceptAndNotifyWali(prospect: Prospect): JMServiceResult
}

interface WaliService {
    fun inviteDifferentWali(): JMServiceResult
}

interface ChatService {
    fun startSupervisedVideoCall(): JMServiceResult
}

interface NotificationService {
    fun openNotifications(): JMServiceResult
}

data class JustMarriageServices(
    val auth: AuthService,
    val verification: VerificationService,
    val profile: ProfileService,
    val matching: MatchingService,
    val wali: WaliService,
    val chat: ChatService,
    val notifications: NotificationService,
)

object PreviewJustMarriageServices {
    val current = JustMarriageServices(
        auth = object : AuthService {
            override fun signOut() = JMServiceResult.Blocked(
                "Sign out is blocked until the auth service boundary is wired.",
            )
        },
        verification = object : VerificationService {
            override fun verifyPhoneCode(code: String) = JMServiceResult.Blocked(
                "Verification service is not connected yet. Code entry is ready for the secure provider integration.",
            )
        },
        profile = object : ProfileService {
            override fun saveQuestionnaireAnswer(section: String, rating: Int) = JMServiceResult.Ready(
                "Saved locally. The next profile section is available when the profile service syncs.",
            )
        },
        matching = object : MatchingService {
            override val canNotifyWali = false
            override fun acceptAndNotifyWali(prospect: Prospect) = JMServiceResult.Blocked(
                "Wali notification service is required before this acceptance can be sent.",
            )
        },
        wali = object : WaliService {
            override fun inviteDifferentWali() = JMServiceResult.Blocked(
                "Alternative wali invite is blocked until contact-service wiring is available. Yusuf remains the active wali.",
            )
        },
        chat = object : ChatService {
            override fun startSupervisedVideoCall() = JMServiceResult.Blocked(
                "Supervised video calls require wali scheduling service wiring.",
            )
        },
        notifications = object : NotificationService {
            override fun openNotifications() = JMServiceResult.Blocked(
                "Notifications require push-service wiring before production.",
            )
        },
    )
}

fun JMServiceResult.message(): String = when (this) {
    is JMServiceResult.Blocked -> message
    is JMServiceResult.Ready -> message
}
