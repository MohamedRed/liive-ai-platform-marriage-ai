import { HttpsError } from "firebase-functions/v2/https";
import {
  authorizeSupervisedChatAccess,
  buildSupervisedChatMessageWrite,
  parseGetSupervisedChatMessagesPayload,
  parseSendSupervisedChatMessagePayload,
  sanitizeSupervisedChatMessages,
  SUPERVISED_CHATS_COLLECTION,
} from "../domains/marriage/supervised-chat";

describe("supervised chat authorization", () => {
  const timestamp = { seconds: 123, nanoseconds: 456 };

  function acceptedMatch(candidateId: string, waliId: string) {
    return {
      id: candidateId,
      status: "accepted",
      acceptance: {
        status: "accepted",
        waliId,
      },
    };
  }

  it("parses and canonicalizes send-message payloads", () => {
    expect(parseSendSupervisedChatMessagePayload({
      matchedUserId: " user-2 ",
      message: "  Assalamu alaikum  ",
      idempotencyKey: " key-1 ",
    })).toEqual({
      matchedUserId: "user-2",
      message: "Assalamu alaikum",
      idempotencyKey: "key-1",
    });
  });

  it("rejects malformed send-message payloads", () => {
    for (const payload of [undefined, null, {}, { matchedUserId: "" }, { matchedUserId: "user-2", message: "" }, { matchedUserId: "user-2", message: "x".repeat(2001) }]) {
      expect(() => parseSendSupervisedChatMessagePayload(payload)).toThrow(HttpsError);
    }
  });

  it("requires reciprocal accepted matches and wali authorization", () => {
    const requesterMatchDoc = { matches: [acceptedMatch("user-2", "wali-1")] };

    expect(() => buildSupervisedChatMessageWrite({
      senderUserId: "user-1",
      matchedUserId: "user-2",
      message: "hello",
      requesterMatchDocument: requesterMatchDoc,
      matchedUserMatchDocument: null,
      timestamp,
    })).toThrow(HttpsError);

    expect(() => buildSupervisedChatMessageWrite({
      senderUserId: "user-1",
      matchedUserId: "user-2",
      message: "hello",
      requesterMatchDocument: requesterMatchDoc,
      matchedUserMatchDocument: { matches: [{ id: "user-1", status: "pending", acceptance: { waliId: "wali-2" } }] },
      timestamp,
    })).toThrow(HttpsError);

    expect(() => buildSupervisedChatMessageWrite({
      senderUserId: "user-1",
      matchedUserId: "user-2",
      message: "hello",
      requesterMatchDocument: requesterMatchDoc,
      matchedUserMatchDocument: { matches: [{ id: "user-1", status: "accepted", acceptance: {} }] },
      timestamp,
    })).toThrow(HttpsError);
  });

  it("builds deterministic chat, message, and audit records for authorized messages", () => {
    const result = buildSupervisedChatMessageWrite({
      senderUserId: " user-1 ",
      matchedUserId: " user-2 ",
      message: " Assalamu alaikum ",
      requesterMatchDocument: { matches: [acceptedMatch("user-2", "wali-1")] },
      matchedUserMatchDocument: { matches: [acceptedMatch("user-1", "wali-2")] },
      timestamp,
      idempotencyKey: "send-1",
    });

    expect(SUPERVISED_CHATS_COLLECTION).toBe("SUPERVISED_CHATS");
    expect(result.chatId).toBe("marriage_chat_user-1_user-2");
    expect(result.chatRecord).toMatchObject({
      participantIds: ["user-1", "user-2"],
      waliIds: ["wali-1", "wali-2"],
      status: "active",
      supervision: "wali_supervised",
    });
    expect(result.messageRecord).toMatchObject({
      chatId: "marriage_chat_user-1_user-2",
      senderUserId: "user-1",
      recipientUserId: "user-2",
      body: "Assalamu alaikum",
      waliVisible: true,
      idempotencyKey: "send-1",
    });
    expect(result.auditEvent).toMatchObject({
      type: "supervised_chat_message_sent",
      actorUserId: "user-1",
      matchedUserId: "user-2",
      chatId: "marriage_chat_user-1_user-2",
      waliIds: ["wali-1", "wali-2"],
    });
  });

  it("parses supervised-chat read payloads with bounded limits", () => {
    expect(parseGetSupervisedChatMessagesPayload({ matchedUserId: " user-2 ", limit: 75 })).toEqual({
      matchedUserId: "user-2",
      limit: 75,
    });
    expect(parseGetSupervisedChatMessagesPayload({ matchedUserId: "user-2" })).toEqual({
      matchedUserId: "user-2",
      limit: 50,
    });

    for (const payload of [undefined, {}, { matchedUserId: "" }, { matchedUserId: "user-2", limit: 0 }, { matchedUserId: "user-2", limit: 101 }]) {
      expect(() => parseGetSupervisedChatMessagesPayload(payload)).toThrow(HttpsError);
    }
  });

  it("authorizes supervised-chat reads only after reciprocal wali-gated match state", () => {
    const access = authorizeSupervisedChatAccess({
      requesterUserId: " user-1 ",
      matchedUserId: " user-2 ",
      requesterMatchDocument: { matches: [acceptedMatch("user-2", "wali-1")] },
      matchedUserMatchDocument: { matches: [acceptedMatch("user-1", "wali-2")] },
    });

    expect(access).toEqual({
      chatId: "marriage_chat_user-1_user-2",
      participantIds: ["user-1", "user-2"],
      waliIds: ["wali-1", "wali-2"],
    });
    expect(() => authorizeSupervisedChatAccess({
      requesterUserId: "user-1",
      matchedUserId: "user-2",
      requesterMatchDocument: { matches: [acceptedMatch("user-2", "wali-1")] },
      matchedUserMatchDocument: { matches: [] },
    })).toThrow(HttpsError);
  });

  it("sanitizes supervised-chat message reads without leaking internal fields", () => {
    const messages = sanitizeSupervisedChatMessages([
      {
        id: "message-1",
        chatId: "marriage_chat_user-1_user-2",
        senderUserId: "user-1",
        recipientUserId: "user-2",
        body: "Assalamu alaikum",
        createdAt: timestamp,
        idempotencyKey: "send-1",
        waliIds: ["wali-1", "wali-2"],
      },
      {
        id: "message-2",
        chatId: "marriage_chat_user-1_user-2",
        senderUserId: "user-2",
        recipientUserId: "user-1",
        body: "Wa alaikum assalam",
        createdAt: timestamp,
      },
      { id: "bad-message", body: 123 },
    ]);

    expect(messages).toEqual([
      {
        id: "message-1",
        chatId: "marriage_chat_user-1_user-2",
        senderUserId: "user-1",
        recipientUserId: "user-2",
        body: "Assalamu alaikum",
        createdAt: timestamp,
      },
      {
        id: "message-2",
        chatId: "marriage_chat_user-1_user-2",
        senderUserId: "user-2",
        recipientUserId: "user-1",
        body: "Wa alaikum assalam",
        createdAt: timestamp,
      },
    ]);
    expect(messages[0]).not.toHaveProperty("idempotencyKey");
    expect(messages[0]).not.toHaveProperty("waliIds");
  });
});
