// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as admin from "firebase-admin";
import { beforeEach, afterEach, describe, it, expect, jest } from "@jest/globals";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as lk from "@livekit/server-sdk";

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  return {
    initializeApp: jest.fn(),
    firestore: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{
            id: "test-doc-id",
            exists: true,
            data: jest.fn().mockReturnValue({}),
            ref: { update: jest.fn().mockResolvedValue({}) }
          }]
        })
      }),
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: jest.fn().mockReturnValue({}),
          updateTime: { toMillis: jest.fn().mockReturnValue(Date.now()) }
        }),
        set: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({})
      }),
      batch: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        commit: jest.fn().mockResolvedValue({})
      }),
      runTransaction: jest.fn().mockImplementation(callback => 
        Promise.resolve(callback({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: jest.fn().mockReturnValue({})
          }),
          set: jest.fn(),
          update: jest.fn()
        }))
      )
    }),
    auth: jest.fn().mockReturnValue({
      createUser: jest.fn().mockResolvedValue({ uid: "test-user-id" }),
      getUserByEmail: jest.fn().mockResolvedValue({ uid: "test-user-id" }),
      getUser: jest.fn().mockResolvedValue({ uid: "test-user-id" })
    }),
    messaging: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue("message-id")
    }),
    FieldValue: {
      serverTimestamp: jest.fn().mockReturnValue("server-timestamp"),
      arrayUnion: jest.fn((...args) => args),
      delete: jest.fn()
    },
    Timestamp: {
      now: jest.fn().mockReturnValue({
        toDate: jest.fn().mockReturnValue(new Date()),
        seconds: 1234567890,
        nanoseconds: 123456789
      }),
      fromDate: jest.fn().mockReturnValue({
        toDate: jest.fn().mockReturnValue(new Date()),
        seconds: 1234567890,
        nanoseconds: 123456789
      })
    },
    credential: {
      applicationDefault: jest.fn(),
      cert: jest.fn()
    }
  } as any;
});

// Mock firebase-functions
jest.mock("firebase-functions", () => {
  return {
    https: {
      onCall: jest.fn(handler => handler),
      onRequest: jest.fn(handler => handler),
    },
    firestore: {
      document: jest.fn(() => ({
        onWrite: jest.fn(handler => handler),
        onUpdate: jest.fn(handler => handler),
        onCreate: jest.fn(handler => handler),
        onDelete: jest.fn(handler => handler),
      })),
    },
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
    config: jest.fn().mockReturnValue({
      liivekit: {
        api_key: "test-api-key",
        api_secret: "test-api-secret",
        server_url: "test-server-url",
      },
      openai: {
        api_key: "test-api-key",
      },
      telnyx: {
        api_key: "test-api-key",
        messaging_profile_id: "test-profile-id",
        phone_number: "+1234567890",
      },
    }),
  };
});

// Manual mocks for modules that might not be installed
// Mock telnyx
const telnyxMock = {
  messages: {
    create: jest.fn().mockResolvedValue({ id: "test-message-id" })
  }
} as any;
jest.mock("telnyx", () => ({
  default: jest.fn(() => telnyxMock)
}));

// Mock openai
const openaiMock = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "test response" } }],
      })
    }
  }
} as any;
jest.mock("openai", () => ({
  OpenAI: jest.fn(() => openaiMock)
}));

// Mock @livekit/server-sdk without requiring the actual module
jest.mock("@livekit/server-sdk", () => {
  const mockRoomServiceClient = {
    createRoom: jest.fn().mockResolvedValue({ name: "test-room" }),
    listRooms: jest.fn().mockResolvedValue([{ name: "test-room" }]),
    listParticipants: jest.fn().mockResolvedValue([{ identity: "test-user" }]),
    deleteRoom: jest.fn().mockResolvedValue({})
  } as any;
  
  const mockAccessToken = {
    addGrant: jest.fn(),
    toJwt: jest.fn().mockReturnValue("test-token")
  } as any;
  
  return {
    RoomServiceClient: jest.fn(() => mockRoomServiceClient),
    AccessToken: jest.fn(() => mockAccessToken),
    VideoGrant: jest.fn(),
  };
}, { virtual: true });

// Mock stripe without requiring the module
jest.mock("stripe", () => {
  const mockVerificationSession = {
    id: "test-session",
    status: "verified",
    last_verification_report: {
      id: "test-report",
      document: { type: "driving_license" },
      selfie: { selfie_image_id: "test-image" },
      id_number: { dob: { day: 1, month: 1, year: 1990 } },
      address: { city: "Test City", country: "US" }
    }
  };

  return jest.fn(() => ({
    identity: {
      verificationSessions: {
        retrieve: jest.fn().mockResolvedValue(mockVerificationSession)
      }
    }
  })) as any;
}, { virtual: true });

// A placeholder for the imported functions
let myFunctions: any;

describe("Cloud Functions Tests", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Date object for consistent time-based tests
    jest.useFakeTimers().setSystemTime(new Date("2023-01-01T12:00:00Z"));
    
    // Import the functions fresh for each test
    jest.isolateModules(() => {
      try {
        myFunctions = require("../index");
      } catch (error) {
        console.error("Error importing functions:", error);
      }
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // Basic smoke test
  it("should be able to import the functions module", () => {
    expect(myFunctions).not.toBeUndefined();
  });

  // Testing utility functions
  describe("Utility Functions", () => {
    // Test any exposed utility functions
    it("should expose key functions", () => {
      const functionNames = Object.keys(myFunctions);
      console.log("Available functions:", functionNames);
      
      // Verify that some expected functions exist
      expect(functionNames.length).toBeGreaterThan(0);
      
      // Verify specific domain groups and callable functions are available.
      expect(myFunctions.userFunctions).toBeDefined();
      expect(myFunctions.marriageFunctions).toBeDefined();
      expect(myFunctions.identityVerificationFunctions).toBeDefined();
      expect(myFunctions.generateMealPlan).toBeDefined();
    });
  });

  // Simply test that Marriage callable functions exist
  describe("Marriage Functions", () => {
    it("getUserQA should be defined", () => {
      expect(myFunctions.marriageFunctions.getUserQA).toBeDefined();
    });

    it("updateUserAnswers should be defined", () => {
      expect(myFunctions.marriageFunctions.updateUserAnswers).toBeDefined();
    });

    it("acceptMatch should be defined", () => {
      expect(myFunctions.marriageFunctions.acceptMatch).toBeDefined();
    });

    it("declineMatch should be defined", () => {
      expect(myFunctions.marriageFunctions.declineMatch).toBeDefined();
    });

    it("unmatch should be defined", () => {
      expect(myFunctions.marriageFunctions.unmatch).toBeDefined();
    });

    it("sendSupervisedChatMessage should be defined", () => {
      expect(myFunctions.marriageFunctions.sendSupervisedChatMessage).toBeDefined();
    });

    it("getSupervisedChatMessages should be defined", () => {
      expect(myFunctions.marriageFunctions.getSupervisedChatMessages).toBeDefined();
    });

    it("registerNotificationDevice should be defined", () => {
      expect(myFunctions.marriageFunctions.registerNotificationDevice).toBeDefined();
    });

    it("blockMarriageUser should be defined", () => {
      expect(myFunctions.marriageFunctions.blockMarriageUser).toBeDefined();
    });

    it("reportMarriageUser should be defined", () => {
      expect(myFunctions.marriageFunctions.reportMarriageUser).toBeDefined();
    });

    it("reviewMarriageReport should be defined", () => {
      expect(myFunctions.marriageFunctions.reviewMarriageReport).toBeDefined();
    });

    it("processMatchAcceptanceNotifications should be defined", () => {
      expect(myFunctions.marriageFunctions.processMatchAcceptanceNotifications).toBeDefined();
    });
  });

  // Simply test that identity verification functions exist
  describe("Identity Verification Functions", () => {
    it("createIdentityVerificationSession should be defined", () => {
      expect(myFunctions.identityVerificationFunctions.createIdentityVerificationSession).toBeDefined();
    });

    it("stripeIdentityWebhook should be defined", () => {
      expect(myFunctions.identityVerificationFunctions.stripeIdentityWebhook).toBeDefined();
    });
  });
}); 