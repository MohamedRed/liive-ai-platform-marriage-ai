import {onCall, onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import Stripe from "stripe";
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";
import {logger} from "firebase-functions";
import {firestore} from "firebase-admin";
import {getAuth} from "firebase-admin/auth";
import {z as zod} from "zod";
import {google} from "@google-cloud/tasks/build/protos/protos";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {FieldValue} from "@google-cloud/firestore";
import {PubSub} from '@google-cloud/pubsub';
import * as admin from 'firebase-admin';
import { RoomServiceClient, ParticipantInfo, Room } from 'livekit-server-sdk';
import { CloudTasksClient } from '@google-cloud/tasks';
import { 
  COLLECTIONS, 
  NewWaliSchema, 
  StripeOutputsType,
  UserInfo,
  WaliInfo,
  WaliUserProvidedInfo,
  QuestionsAnswers,
  IdentityVerification,
  WaliRelationVerification,
  RelationshipType,
  VerificationStatus,
  ProfileEvent,
  UserSettings
} from '@liive-marriage-ai/database-types';

import Timestamp = firestore.Timestamp;
import ITask = google.cloud.tasks.v2.ITask;

import type { Telnyx } from 'telnyx';

enum ApiKeys {
  OPENAI_API_KEY = "projects/206700838957/secrets/OPENAI_API_KEY/versions/latest",
  STRIPE_API_KEY = "projects/206700838957/secrets/STRIPE_API_KEY_SANDBOX_1/versions/latest",
  STRIPE_IDENTITY_WEBHOOK = "projects/206700838957/secrets/STRIPE_IDENTITY_WEBHOOK_SANDBOX1/versions/latest",
  LIVEKIT_API_KEY = "projects/206700838957/secrets/LIVEKIT_API_KEY/versions/latest",
  LIVEKIT_API_SECRET = "projects/206700838957/secrets/LIVEKIT_API_SECRET/versions/latest",
  LIVEKIT_WEBSOCKET_URL = "projects/206700838957/secrets/LIVEKIT_WEBSOCKET_URL/versions/latest",
  TELNYX_API_KEY = "projects/206700838957/secrets/TELNYX_API_KEY/versions/latest",
  STRIPE_IDENTITY_FLOW = "projects/206700838957/secrets/STRIPE_IDENTITY_FLOW/versions/latest",
  PINECONE_API_KEY = "projects/206700838957/secrets/PINECONE_API_KEY/versions/latest"
}

const secretManagerClient = new SecretManagerServiceClient();
const pubSubClient = new PubSub();
const tasksClient = new CloudTasksClient();

async function accessSecret(name: string): Promise<string> {
  const [version] = await secretManagerClient.accessSecretVersion({
    name,
  });
  const payload = version.payload!.data!.toString();
  return payload
}

// Define the structure explicitly instead of using zod inference
type NewWaliDataType = {
  name: {
    first: string;
    last: string;
  };
  contact: {
    phone: string;
    email: string;
  };
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    state?: string;
  };
  relationship: RelationshipType;
};

initializeApp();

exports.stripeIdentityWebhook = onRequest(
  async (request, response) => {

    const stripe = new Stripe(await accessSecret(ApiKeys.STRIPE_API_KEY), {telemetry: false});
    const stripeIdentityWebhookSecret = await accessSecret(ApiKeys.STRIPE_IDENTITY_WEBHOOK)

    let event;

    try {
      const sig = request.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig!,
        stripeIdentityWebhookSecret
      );
      // Return a response to acknowledge receipt of the event
      response.json({ received: true });
    } catch (error) {
      logger.error(["❌ Error verifying stripe event authenticity", error]);
      response.status(400).send(`Webhook Error: ${error}`);
      return
    }

    switch (event!.type) {
      case "identity.verification_session.created":
      case "identity.verification_session.processing":
      case "identity.verification_session.verified":
      case "identity.verification_session.requires_input":
      case "identity.verification_session.canceled":
      case "identity.verification_session.redacted": {
        const identityVerificationSession: Stripe.Identity.VerificationSession = event.data.object;
        const userID = identityVerificationSession.client_reference_id
        const eventTimestamp = event.created

        if (!userID) {
          logger.error({
            message: "Missing userID in identity verification session's client reference id.",
            sessionID: identityVerificationSession.id,
          });
          response.status(400).send("userID missing in session's client reference id.");
          return;
        }

        await updateIDVerificationStatus(userID, eventTimestamp, identityVerificationSession);
        break;
      }
      default:
        logger.info(`Unhandled event type ${event!.type}`);
    }

    async function updateIDVerificationStatus(userID: string,
                                             eventTimestamp: number,
                                             identityVerificationSession: Stripe.Identity.VerificationSession) {
      const firestore = getFirestore();

      // Determine if the user is a Wali
      const waliDoc = await firestore.collection(COLLECTIONS.WALI_INFO).doc(userID).get();
      const isWali = waliDoc.exists;

      try {
        // Convert Stripe timestamp to Firestore Timestamp
        const _eventTimestamp = Timestamp.fromMillis(eventTimestamp * 1000); // in milliseconds
        
        // Check if we already have a verification record for this user
        const existingVerificationDoc = await firestore.collection(COLLECTIONS.IDENTITY_VERIFICATIONS)
          .doc(userID).get();
        
        // If we have an existing record, check if this event is newer
        if (existingVerificationDoc.exists) {
          const existingData = existingVerificationDoc.data();
          const existingUpdatedAt = existingData?.updatedAt;
          
          // Skip processing if this event is older than what we already have
          if (existingUpdatedAt && existingUpdatedAt.toMillis() >= _eventTimestamp.toMillis()) {
            logger.info({
              message: `Skipping older or duplicate event for ${userID}`,
              sessionId: identityVerificationSession.id,
              eventTimestamp: _eventTimestamp.toDate(),
              existingTimestamp: existingUpdatedAt.toDate()
            });
            return;
          }
        }

        // Create verification record according to the IdentityVerification interface
        const verificationData: IdentityVerification = {
          userId: isWali ? undefined : userID,
          waliId: isWali ? userID : undefined,
          provider: 'stripe',
          sessionId: identityVerificationSession.id,
          status: identityVerificationSession.status as unknown as VerificationStatus,
          verificationMetadata: {
            attempts: existingVerificationDoc.exists
              ? (existingVerificationDoc.data()?.verificationMetadata?.attempts || 0) + 1
              : 1
          },
          createdAt: existingVerificationDoc.exists 
            ? existingVerificationDoc.data()?.createdAt 
            : _eventTimestamp,
          updatedAt: _eventTimestamp
        };
        
        // Store verification data using the user ID as the document ID
        await firestore.collection(COLLECTIONS.IDENTITY_VERIFICATIONS).doc(userID)
          .set(verificationData, { merge: true });
        
        logger.info({
          message: `✅ Identity verification status updated for ${userID} to ${identityVerificationSession.status}`,
          collection: COLLECTIONS.IDENTITY_VERIFICATIONS,
          provider: 'stripe',
          sessionId: identityVerificationSession.id
        });
      } catch (error) {
        logger.error({
          message: `❌ Error updating identity verification status for ${userID}`,
          error,
        });
      }
    }
  }
);

exports.createVerificationSession = onCall(async (request) => {
  const stripe = new Stripe(await accessSecret(ApiKeys.STRIPE_API_KEY), { telemetry: false });
  const firestore = getFirestore();
  const userID = request.auth?.uid;

  if (!userID) {
    throw new Error("User not authenticated");
  }

  // Check if user is a regular user or attempting to verify as a Wali
  const profileRef = firestore.doc(`${COLLECTIONS.USER_INFO}/${userID}`);
  // Check for info in WaliUserProvidedInfo collection instead of WALI_INFO
  const waliProvidedInfoRef = firestore.doc(`${COLLECTIONS.WALI_USER_PROVIDED_INFO}/${userID}`);
  
  const [profileDoc, waliProvidedInfoDoc] = await Promise.all([
    profileRef.get(),
    waliProvidedInfoRef.get()
  ]);

  const isProvidedWaliInfo = waliProvidedInfoDoc.exists;
  
  // Check for existing verification record
  const verificationRef = firestore.doc(`${COLLECTIONS.IDENTITY_VERIFICATIONS}/${userID}`);
  const verificationDoc = await verificationRef.get();
  
  // If there's an existing verification with a session ID, retrieve and return it
  if (verificationDoc.exists) {
    const verificationData = verificationDoc.data() as IdentityVerification;
    if (verificationData.sessionId) {
      try {
        const verificationSession = await stripe.identity.verificationSessions.retrieve(
          verificationData.sessionId
        );
        
        // Only return if the session is still valid (using explicit status checks)
        const validStatuses = ['created', 'processing', 'requires_input', 'verified'];
        if (validStatuses.includes(verificationSession.status)) {
          return {
            url: verificationSession.url
          };
        }
      } catch (error) {
        // Session might have expired or been deleted in Stripe
        console.log(`Failed to retrieve existing session: ${error}`);
        // Continue to create a new session
      }
    }
  }

  // Get user contact details based on user type
  let email, phone;
  
  if (isProvidedWaliInfo) {
    // Get wali information from WaliUserProvidedInfo
    if (!waliProvidedInfoDoc.exists) {
      throw new Error("Wali provided information not found");
    }
    const waliData = waliProvidedInfoDoc.data() as WaliUserProvidedInfo;
    // Extract contact details based on the WaliUserProvidedInfo interface structure
    email = waliData.personalInfo.contact.email;
    phone = waliData.personalInfo.contact.phoneNumber;
  } else {
    // Get user contact information from UserInfo
    if (!profileDoc.exists) {
      throw new Error("User profile not found");
    }
    const userData = profileDoc.data() as UserInfo;
    // Extract contact details based on the UserInfo interface structure
    email = userData.contact?.email;
    phone = userData.contact?.phoneNumber;
  }

  if (!email && !phone) {
    throw new Error("User must have either email or phone number to verify identity");
  }

  // Create new verification session in Stripe
  const verificationSession = await stripe.identity.verificationSessions.create({
    verification_flow: await accessSecret(ApiKeys.STRIPE_IDENTITY_FLOW),
    provided_details: { email, phone },
    client_reference_id: userID,
  });

  // Save the new session information in Firestore
  const _timestamp = Timestamp.now();
  const verificationData: IdentityVerification = {
    userId: isProvidedWaliInfo ? undefined : userID,
    waliId: isProvidedWaliInfo ? userID : undefined,
    provider: 'stripe',
    sessionId: verificationSession.id,
    status: verificationSession.status as unknown as VerificationStatus,
    verificationMetadata: {
      attempts: verificationDoc.exists 
        ? ((verificationDoc.data() as IdentityVerification)?.verificationMetadata?.attempts || 0) + 1 
        : 1
    },
    createdAt: verificationDoc.exists 
      ? (verificationDoc.data() as IdentityVerification)?.createdAt 
      : _timestamp,
    updatedAt: _timestamp
  };
  
  await firestore.collection(COLLECTIONS.IDENTITY_VERIFICATIONS).doc(userID)
    .set(verificationData, { merge: true });

  return {
    url: verificationSession.url
  };
});

exports.createWali = onCall(async (request) => {
  const userID = request.auth!.uid; // User who is adding the Wali
  const wali = validateNewWali(request.data); // Wali profile data

  if (!wali.name?.first || !wali.contact?.phone) {
    throw new Error("First name and phone number are required for Wali profile.");
  }

  try {
    // Fetch user profile to get user information
    const userInfo = await getUserProfile(userID);
    if (!userInfo) {
      throw new Error("User profile is missing.");
    }

    const waliUser = await createFirebaseUser(wali);
    await saveWaliProfile(userID, wali, waliUser.uid);
    // await sendOnboardingSMS(wali.contact.phone, `${userInfo.personalInfo.name.firstName} ${userInfo.personalInfo.name.lastName}`, waliUser.uid);

    return { result: "success", waliProfileId: waliUser.uid };
  } catch (error) {
    console.error("Error creating Wali profile or sending SMS:", error);
    throw new Error("Failed to create Wali profile. Please try again.");
  }

  function validateNewWali(data: unknown): NewWaliDataType {
    return NewWaliSchema.parse(data) as unknown as NewWaliDataType;
  };

  // Helper: Create Firebase User
  async function createFirebaseUser(wali: NewWaliDataType) {
    const auth = getAuth();
    return await auth.createUser({
      phoneNumber: wali.contact.phone,
      displayName: `${wali.name.first} ${wali.name.last || ""}`,
    });
  };

  // Helper: Save Wali Profile
  async function saveWaliProfile(userID: string, wali: NewWaliDataType, waliId: string) {
    const firestore = getFirestore();
    const timestamp = Timestamp.now();
    
    // Save to WaliUserProvidedInfo collection
    const waliUserProvidedInfo: WaliUserProvidedInfo = {
      userId: userID,
      relationship: wali.relationship,
      personalInfo: {
        name: {
          firstName: wali.name.first,
          lastName: wali.name.last,
        },
        contact: {
          email: wali.contact.email,
          phoneNumber: wali.contact.phone,
        },
        address: {
          street: wali.address.street,
          city: wali.address.city,
          state: wali.address.state || '',
          country: wali.address.country,
          postalCode: wali.address.postalCode,
        }
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // Create relationship verification record
    const relationVerification: WaliRelationVerification = {
      userId: userID,
      waliId: waliId,
      relationship: wali.relationship,
      status: VerificationStatus.PENDING,
      verificationMetadata: {
        attempts: 0
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    // Update multiple collections in a batch
    const batch = firestore.batch();
    
    // Save wali user provided info
    batch.set(
      firestore.collection(COLLECTIONS.WALI_USER_PROVIDED_INFO).doc(waliId),
      waliUserProvidedInfo
    );
    
    // Create relation verification record - using a compound ID for easy querying
    batch.set(
      firestore.collection(COLLECTIONS.USER_WALI_RELATION_VERIFICATIONS).doc(`${userID}_${waliId}`),
      relationVerification
    );
    
    // Commit the batch
    await batch.commit();
    
    logger.info({
      message: `Created Wali profile for user ${userID}`,
      waliId,
      relationship: wali.relationship,
      verificationStatus: VerificationStatus.PENDING
    });
  };

  // Helper: Send Onboarding SMS
  /* async function sendOnboardingSMS(phoneNumber: string, relationName: string, waliProfileId: string) {
      const initTelnyx = async () => {
      const TelnyxModule = await import('telnyx');
      return TelnyxModule.default;
    };

    const telnyxClient = await initTelnyx();  
    const smsBody = `Assalam alaikoum from Liive Marriage! ${relationName} just added you as their Wali. ` +
      "Let's get onboard and find the perfect match for your loved one inshaaAllah. Bismillah! " +
      `Proceed with onboarding here: www.liive.app/wali/onboarding/${waliProfileId}`;

    await telnyxClient.messages.create({
      from: "YOUR_TELNYX_PHONE_NUMBER", // Replace with your Telnyx phone number
      to: phoneNumber,
      text: smsBody,
      use_profile_webhooks: false,
      auto_detect: true
    });
  }; */
});

exports.isWali = onCall(async (request) => {
  const waliID = request.auth?.uid;
  const stripe = new Stripe(await accessSecret(ApiKeys.STRIPE_API_KEY), {telemetry: false});
  const firestore = getFirestore();

  if (!waliID) {
    throw new Error("Wali must be authenticated.");
  }

  try {
    // Find the user associated with this wali through the relation verification
    const relationQuery = await firestore.collection(COLLECTIONS.USER_WALI_RELATION_VERIFICATIONS)
      .where('waliId', '==', waliID)
      .limit(1)
      .get();
    
    if (relationQuery.empty) {
      throw new Error("No relationship verification found for this Wali.");
    }
    
    const relationData = relationQuery.docs[0].data() as WaliRelationVerification;
    const userID = relationData.userId;
    
    // Get user and wali profiles
    const [userDoc, waliDoc] = await Promise.all([
      firestore.collection(COLLECTIONS.USER_INFO).doc(userID).get(),
      firestore.collection(COLLECTIONS.WALI_INFO).doc(waliID).get()
    ]);
    
    if (!userDoc.exists || !waliDoc.exists) {
      throw new Error(`User or Wali profile not found. User exists: ${userDoc.exists}, Wali exists: ${waliDoc.exists}`);
    }
    
    const userData = userDoc.data() as UserInfo;
    const waliData = waliDoc.data() as WaliInfo;
    
    // Get identity verification records for both user and wali
    const [userVerificationDoc, waliVerificationDoc] = await Promise.all([
      firestore.collection(COLLECTIONS.IDENTITY_VERIFICATIONS).doc(userID).get(),
      firestore.collection(COLLECTIONS.IDENTITY_VERIFICATIONS).doc(waliID).get()
    ]);
    
    if (!userVerificationDoc.exists || !waliVerificationDoc.exists) {
      throw new Error("Identity verification records not found for user or wali");
    }
    
    const userVerification = userVerificationDoc.data() as IdentityVerification;
    const waliVerification = waliVerificationDoc.data() as IdentityVerification;
    
    if (!userVerification.sessionId || !waliVerification.sessionId) {
      throw new Error("Verification session IDs missing");
    }
    
    // Retrieve verification outputs from Stripe
    const [userOutputs, waliOutputs] = await Promise.all([
      getVerificationOutputs(userVerification.sessionId),
      getVerificationOutputs(waliVerification.sessionId),
    ]);

    if (!userOutputs) {
      throw new Error("User ID information not found.");
    }

    if (!waliOutputs) {
      throw new Error("Wali ID information not found.");
    }

    // Perform validation
    const isValid = validateWali(
      userData, 
      waliData, 
      relationData.relationship,
      userOutputs as StripeOutputsType, 
      waliOutputs as StripeOutputsType
    );

    // Update verification status in the relation verification record
    await updateVerificationStatus(waliID, userID, isValid ? VerificationStatus.VERIFIED : VerificationStatus.REQUIRES_INPUT);

    return { isValid };
  } catch (err) {
    // Properly handle the unknown error type
    const error = err as Error;
    console.error("Error verifying Wali relationship:", error);
    
    // We can't update the verification status here because we don't have userID
    // in case the error happened while retrieving the relationship
    throw new Error("Failed to verify Wali relationship: " + error.message);
  }

  // Helper function to update verification status
  async function updateVerificationStatus(waliID: string, userID: string, status: string) {
    // Query to find the verification document for this wali-user pair
    const verificationQuery = await firestore.collection(COLLECTIONS.USER_WALI_RELATION_VERIFICATIONS)
      .where('waliId', '==', waliID)
      .where('userId', '==', userID)
      .limit(1)
      .get();
    
    // Convert string status to enum value
    const verificationStatus = status as unknown as VerificationStatus;
    
    if (!verificationQuery.empty) {
      const verificationDoc = verificationQuery.docs[0];
      await verificationDoc.ref.update({
        status: verificationStatus,
        updatedAt: Timestamp.now(),
        'verificationMetadata.attempts': admin.firestore.FieldValue.increment(1)
      });
    } else {
      // Create new verification record if it doesn't exist
      await firestore.collection(COLLECTIONS.USER_WALI_RELATION_VERIFICATIONS).add({
        userId: userID,
        waliId: waliID,
        status: verificationStatus,
        relationship: RelationshipType.OTHER, // Default, should be updated with real value if available
        verificationMetadata: {
          attempts: 1
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }
    
    logger.info(`Successfully updated verification status to: ${status}`);
  }

  async function getVerificationOutputs(sessionID: string) {
    const session = await stripe.identity.verificationSessions.retrieve(sessionID, {
      expand: [
        "verified_outputs.last_name",
        "verified_outputs.dob",
        "verified_outputs.address",
      ],
    });

    return session.verified_outputs;
  }

  function validateWali(
    userData: UserInfo,
    waliData: WaliInfo,
    relationship: RelationshipType,
    userOutputs: StripeOutputsType,
    waliOutputs: StripeOutputsType
  ) {
    return (
      isRelationshipEligible(relationship) && // Check relationship type
      isLastNameMatch(userOutputs.last_name, waliOutputs.last_name) && // Check if last names match
      isAgeEligible(userOutputs.dob!, waliOutputs.dob!) && // Check if age difference is valid
      isSameCity(userOutputs.address?.city, waliOutputs.address?.city) // Check if both live in the same city
    );
  }

  function isRelationshipEligible(relationship: RelationshipType): boolean {
    const allowedRelationships = [
      RelationshipType.FATHER, 
      RelationshipType.BROTHER, 
      RelationshipType.UNCLE
    ];
    return allowedRelationships.includes(relationship);
  }

  function isLastNameMatch(userLastName?: string, waliLastName?: string): boolean {
    if (!userLastName || !waliLastName) return true; // If either is missing, skip check or handle differently
    return userLastName.toLowerCase() === waliLastName.toLowerCase();
  }

  function isAgeEligible(userDob: { day: number; month: number; year: number },
                         waliDob: { day: number; month: number; year: number }): boolean {
    const userAge = calculateAge(userDob);
    const waliAge = calculateAge(waliDob);

    // For father/uncle/brother, you might have different rules for age gaps
    return waliAge >= userAge;
  }

  function calculateAge(dob: { day: number, month: number, year: number }): number {
    const today = new Date();
    const birthDate = new Date(dob.year, dob.month - 1, dob.day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Checks if user and wali share the same city.
   *
   * @param userCity - the city name from the user's verified address
   * @param waliCity - the city name from the wali's verified address
   * @returns true if both cities match (case-insensitive), false otherwise
   */
  function isSameCity(userCity?: string, waliCity?: string): boolean {
    if (!userCity || !waliCity) {
      return false; // If either city is missing, we can't confirm they're the same
    }
    return userCity.trim().toLowerCase() === waliCity.trim().toLowerCase();
  }
});

// Trigger when a user's questions and answers are updated
exports.onUserQuestionsUpdate = onDocumentWritten(`${COLLECTIONS.QUESTIONS_ANSWERS}/{userID}`, async (event) => {
  const userID = event.params.userID;
  const userAnswers = event.data?.after.data();
  if (!userAnswers) {
    throw new Error("Updated user answers not found in the event.");
  }

  const firestore = getFirestore();

  await saveEvent();

  try {
    // Use Firestore transaction to handle concurrency
    await firestore.runTransaction(async (transaction) => {
      const userAnswersDoc = await transaction.get(firestore.collection(COLLECTIONS.QUESTIONS_ANSWERS).doc(userID));
      if (!userAnswersDoc.exists) {
        throw new Error("User answers not found.");
      }

      const userData = userAnswersDoc.data() as QuestionsAnswers;
      
      // Get the last update timestamp - use the document's update time from the snapshot metadata
      // This is available on all Firestore documents regardless of their structure
      const lastUpdateTimestamp = userAnswersDoc.updateTime?.toMillis() || 0;
      
      // Convert event.time to UNIX timestamp (milliseconds since epoch)
      const newTimestamp = new Date(event.time).getTime();

      // Check if this event is newer than the last update
      if (newTimestamp <= lastUpdateTimestamp) {
        logger.info("Duplicate or out-of-order event, skipping...");
        return {message: "Event skipped."};
      }

      // 1. Cancel any existing delayed task
      await cancelExistingDelayedTask(userID);

      // 2. Publish immediate matching event
      const immediateMessage = {
        data: Buffer.from(JSON.stringify({
          userId: userID,
          timestamp: new Date().toISOString(),
          eventType: "answers_update"
        })),
        attributes: {
          userId: userID
        }
      };
      await pubSubClient.topic('user-profile-updated').publishMessage(immediateMessage);

      // No need to update a separate timestamps collection, the updatedAt field in the QuestionsAnswers
      // document will be updated automatically by the Firestore trigger that caused this event

      logger.info("Answers updated pubsub event successfully sent for user:", userID);

      return { message: "Transaction completed successfully." };
    });

    return { message: "Answers update event successfully processed." };
  } catch (error) {
    console.error(`Error processing Answers update event for user ${userID}:`, error);
    return { message: "Error processing Answers update event", error: error };
  }

  async function saveEvent() {
    const newAnswersData = event.data?.after.data() as QuestionsAnswers;
    const previousAnswersData = event.data?.before.data() as QuestionsAnswers;

    if (!newAnswersData) {
      logger.error("No answers data available for update.");
      return;
    }

    // Get the questions collection
    const questions = newAnswersData.questions || {};
    const previousQuestions = previousAnswersData?.questions || {};
    const timestamp = Timestamp.fromDate(new Date(event.time));

    // Process changed questions
    for (const questionId in questions) {
      // If question is new or answer has changed
      if (!previousQuestions[questionId] || 
          previousQuestions[questionId]?.answer !== questions[questionId]?.answer) {
        
        // Get question details
        const newQuestion = questions[questionId];
        const previousQuestion = previousQuestions[questionId];
        
        // Reference to the QA edit log document for this specific question
        const questionEditLogRef = firestore
          .collection(COLLECTIONS.QA_EDIT_LOGS)
          .doc(`${userID}_${questionId}`);
        
        // Get existing log document or create new one
        const existingLogDoc = await questionEditLogRef.get();
        
        if (existingLogDoc.exists) {
          // Update existing document by adding to the edits array
          await questionEditLogRef.update({
            edits: admin.firestore.FieldValue.arrayUnion({
              previousAnswer: previousQuestion?.answer || '',
              newAnswer: newQuestion.answer,
              createdAt: timestamp
            }),
            updatedAt: timestamp
          });
        } else {
          // Create new document with initial edits array
          await questionEditLogRef.set({
            userId: userID,
            questionId: questionId,
            edits: [{
              previousAnswer: previousQuestion?.answer || '',
              newAnswer: newQuestion.answer,
              createdAt: timestamp
            }],
            createdAt: timestamp,
            updatedAt: timestamp
          });
        }
        
        logger.info(`Answer edit logged for user ${userID}, question ${questionId}`, {
          questionId,
          previousAnswer: previousQuestion?.answer || '',
          newAnswer: newQuestion.answer
        });
      }
    }
  }
  
  async function cancelExistingDelayedTask(userID: string) {
    const taskDoc = await firestore.collection('delayed_matching_tasks').doc(userID).get();
    
    if (taskDoc.exists) {
      const taskData = taskDoc.data();
      if (taskData?.taskName) {
        try {
          await tasksClient.deleteTask({ name: taskData.taskName });
        } catch (error) {
          // Task might have already executed or been deleted
          console.log(`Task ${taskData.taskName} could not be deleted:`, error);
        }
        await taskDoc.ref.delete();
      }
    }
  }
});
  
// Cloud Function triggered when a document in MATCHES collection is updated
exports.onMatchUpdate = onDocumentWritten(`${COLLECTIONS.MATCHES}/{userID}`, async (event) => {
    const userID = event.params.userID;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Log the function call
    logger.info(`Processing match update for user ${userID}`);

    // Define roomService at the function scope so inner functions can access it
    let roomService: RoomServiceClient;

    try {
        roomService = new RoomServiceClient(
            await accessSecret(ApiKeys.LIVEKIT_WEBSOCKET_URL),
            await accessSecret(ApiKeys.LIVEKIT_API_KEY),
            await accessSecret(ApiKeys.LIVEKIT_API_SECRET)
        );

        // Check if the matches have changed
        if (JSON.stringify(beforeData?.matches) !== JSON.stringify(afterData?.matches)) {
            logger.info(`Match data has changed for user ${userID}`);
            
            // Get user notification preferences from UserSettings collection
            const userSettingsRef = getFirestore().collection(COLLECTIONS.USER_SETTINGS).doc(userID);
            const userSettings = await userSettingsRef.get();
            const userSettingsData = userSettings.exists ? userSettings.data() as UserSettings : null;
            
            // Check if notifications are enabled and if it's an appropriate time
            const notificationPrefs = userSettingsData?.notification?.preferences;
            const isNotificationsEnabled = notificationPrefs?.enabled !== false; // Default to true if not specified
            
            // Check if current time is appropriate for sending notifications
            const isAvailableTime = checkNotificationAvailability(notificationPrefs);
            
            // Process each match
            if (afterData?.matches && Array.isArray(afterData.matches)) {
                for (const match of afterData.matches) {
                    if (match.suggested_questions) {
                        // Check if user is in active call
                        const isInCall = await isInActiveLivekitCall(userID);
                        
                        if (isInCall) {
                            // If user is in active call with AI agent, use voice
                            await notifyVoiceAgent(userID, match);
                        } else if (isNotificationsEnabled && isAvailableTime) {
                            // Otherwise use notifications if enabled and within available time
                            await scheduleNotification(userID, match);
                        } else {
                            logger.info(`Skipping notification for user ${userID} - notifications disabled or outside available hours`);
                        }
                    }
                }
            } else {
                logger.warn(`No valid matches data found for user ${userID}`);
            }
        } else {
            logger.info(`No change in match data for user ${userID}`);
        }
    } catch (error) {
        // Proper error handling
        const err = error as Error;
        logger.error(`Error processing match update for user ${userID}: ${err.message}`, { error: err });
        throw new Error(`Failed to process match update: ${err.message}`);
    }

    /**
     * Checks if the current time is appropriate for sending notifications
     * based on user's notification preferences
     * @param prefs - User's notification preferences
     * @returns true if notifications can be sent at current time
     */
    function checkNotificationAvailability(prefs?: UserSettings['notification']['preferences']): boolean {
        if (!prefs) return true; // Default to available if no preferences are set
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // Check quiet hours first (if set)
        if (prefs.quietHours) {
            const { start, end } = prefs.quietHours;
            
            // Handle both cases: when quiet hours span midnight and when they don't
            if (start <= end) {
                // Normal case: e.g., quiet from 22:00 to 06:00
                if (currentHour >= start && currentHour < end) {
                    return false; // Currently in quiet hours
                }
            } else {
                // Overnight case: e.g., quiet from 22:00 to 06:00
                if (currentHour >= start || currentHour < end) {
                    return false; // Currently in quiet hours
                }
            }
        }
        
        // Check available days (if set)
        if (prefs.availableDays) {
            // Convert day name to property name (e.g., "monday" -> "monday")
            const dayProperty = currentDay as keyof typeof prefs.availableDays;
            
            // If this specific day is configured and set to false, notifications are not available
            if (prefs.availableDays[dayProperty] === false) {
                return false;
            }
        }
        
        // Check available hours for specific days (most granular setting)
        if (prefs.availableHours && prefs.availableHours[currentDay]) {
            const { start, end } = prefs.availableHours[currentDay];
            
            // Handle both cases: when available hours span midnight and when they don't
            if (start <= end) {
                // Normal case: e.g., available from 09:00 to 18:00
                return currentHour >= start && currentHour < end;
            } else {
                // Overnight case: e.g., available from 18:00 to 02:00
                return currentHour >= start || currentHour < end;
            }
        }
        
        // If no specific constraints prevent notifications, allow them
        return true;
    }

    /**
     * @deprecated Use checkNotificationAvailability instead
     * Checks if the current time is within user's available hours
     * @param availableHours - Record of days with start and end hours
     * @returns true if current time is within available hours
     */
    function checkAvailability(availableHours: Record<string, {start: number, end: number}> = {}): boolean {
        const now = new Date();
        const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const hour = now.getHours();
        
        const hours = availableHours[day];
        if (!hours) return false;
        
        return hour >= hours.start && hour <= hours.end;
    }

    /**
     * Checks if the user is in an active LiveKit call
     * @param userId - The user ID to check
     * @returns true if user is in active call
     */
    async function isInActiveLivekitCall(userId: string): Promise<boolean> {
        try {
            const activeRoom = await getActiveRoom(roomService, userId);
            return activeRoom !== undefined;
        } catch (err) {
            logger.warn(`Error checking LiveKit status for user ${userId}: ${(err as Error).message}`);
            return false;
        }
    }  

    /**
     * Schedules a push notification for the user about a new match
     * @param userId - The user ID to notify
     * @param match - The match data with AI score and other details
     */
    async function scheduleNotification(userId: string, match: any) {
        try {
            const task: ITask = {
                httpRequest: {
                    url: `https://${process.env.GOOGLE_CLOUD_PROJECT}.cloudfunctions.net/sendMatchNotification`,
                    headers: { 'Content-Type': 'application/json' },
                    body: Buffer.from(JSON.stringify({
                        userId: userId,
                        title: "New Match Update",
                        message: `We've found a ${match.ai_score}% match! Answer more questions to see if they are a good match.`
                    })).toString('base64')
                }
            };

            // Create the task
            const [createdTask] = await tasksClient.createTask({ parent: 'match-notifications', task });

            // Save task info in Firestore
            await getFirestore().collection('delayed_matching_tasks').doc(userId).set({
                taskName: createdTask.name,
                createdAt: createdTask.createTime ? 
                    Timestamp.fromDate(new Date(Number(createdTask.createTime.seconds) * 1000)) : 
                    FieldValue.serverTimestamp(),
            });

            logger.info(`Notification task created and saved for user ${userId}`);
        } catch (err) {
            logger.error(`Failed to schedule notification for user ${userId}: ${(err as Error).message}`);
            // Don't throw error so we don't fail the entire function
        }
    }
  
    /**
     * Sends instructions to the AI agent in an active call
     * @param userId - The user ID in the call
     * @param match - The match data with AI score and questions
     */
    async function notifyVoiceAgent(userId: string, match: any) {
        try {
            const activeRoom = await getActiveRoom(roomService, userId);
            if (!activeRoom) {
                logger.warn(`No active LiveKit room for user ${userId}`);
                return;
            }

            const agentParticipant = await getAgentParticipant(roomService, activeRoom.name);
            if (!agentParticipant) {
                logger.warn(`No LiveKit agent found for room ${activeRoom.name}`);
                return;
            }

            // Format instructions for the AI
            const instructions = `
                I have found a potential match for you. Let me ask you some questions to verify compatibility:
                
                Match Score: ${match.ai_score}%
                
                Questions to ask:
                ${formatQuestions(match.suggested_questions)}
                
                Please ask these questions naturally as part of our conversation.
            `;

            const payload = Buffer.from(JSON.stringify({
                instructions,
                type: 'system_message'
            }));

            await roomService.sendData(
                activeRoom.name, 
                payload,
                0,
                {destinationIdentities:[agentParticipant.identity], topic: "new_match_found"}
            );
        
            logger.info(`Sent match instructions to LiveKit agent for user ${userId}`);
        } catch (error) {
            logger.error(`Failed to send instructions to LiveKit agent: ${(error as Error).message}`);
            // Don't throw error so we don't fail the entire function
        }
    }

    /**
     * Formats questions into a user-friendly string
     * @param questions - Array of question objects
     * @returns Formatted string of questions
     */
    function formatQuestions(questions: any[]): string {
        if (!questions || !Array.isArray(questions)) {
            return "No suggested questions available.";
        }
        
        return questions.map(q => 
            `- ${q.question}\n  Rationale: ${q.rationale}\n  Section: ${q.section}\n`
        ).join('\n');
    }
});

exports.sendPushNotification = onRequest(async (request, response) => {
  // Extract the required parameters from the request body
  const { userID, title, message } = request.body;

  // Validate input parameters
  if (!userID || !title || !message) {
    const missingParams = [];
    if (!userID) missingParams.push('userID');
    if (!title) missingParams.push('title');
    if (!message) missingParams.push('message');
    
    logger.error(`Missing required parameters: ${missingParams.join(', ')}`);
    response.status(400).send({
      error: 'Missing required parameters',
      details: `The following parameters are required: ${missingParams.join(', ')}`
    });
    return;
  }

  logger.info(`Sending push notification to user ${userID}`);

  try {
    const result = await sendPushNotification(userID, title, message);
    if (result.success) {
      logger.info(`Successfully sent push notification to user ${userID}`);
      response.status(200).send({
        success: true,
        message: 'Push notification sent successfully'
      });
    } else {
      logger.warn(`Unable to send push notification to user ${userID}: ${result.reason}`);
      response.status(200).send({
        success: false,
        message: `Could not send notification: ${result.reason}`
      });
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to send push notification to user ${userID}: ${err.message}`, { error: err });
    response.status(500).send({
      error: 'Internal server error',
      message: 'Failed to send push notification due to a server error'
    });
  }

  /**
   * Sends a push notification to a user via FCM
   * @param userID - The user ID to send the notification to
   * @param title - The notification title
   * @param message - The notification message body
   * @returns Object indicating success or failure with reason
   */
  async function sendPushNotification(userID: string, title: string, message: string): Promise<{success: boolean, reason?: string}> {
    // Get user document to retrieve FCM token from UserSettings
    const userSettingsRef = getFirestore().collection(COLLECTIONS.USER_SETTINGS).doc(userID);
    const userSettingsDoc = await userSettingsRef.get();

    // Check if user settings exist
    if (!userSettingsDoc.exists) {
      logger.warn(`User settings not found for ${userID} for push notification`);
      return { success: false, reason: 'User settings not found' };
    }

    const userSettings = userSettingsDoc.data() as UserSettings;
    const fcmToken = userSettings?.notification?.fcmToken;
    
    return sendNotificationWithToken(userID, title, message, fcmToken);
  }

  /**
   * Helper function to send notification with FCM token
   */
  async function sendNotificationWithToken(userID: string, title: string, message: string, fcmToken?: string): Promise<{success: boolean, reason?: string}> {
    // Try FCM notification if token exists
    if (fcmToken) {
      // Create the notification payload
      const notification = {
        token: fcmToken,
        notification: {
          title: title,
          body: message,
        },
        android: {
          notification: {
            sound: 'default',
            channelId: 'match_notifications'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              category: 'match_notification'
            }
          }
        }
      };

      try {
        // Send the notification
        await admin.messaging().send(notification);
        
        // Log successful notification
        await logNotificationSent(userID, title, 'fcm');
        
        return { success: true };
      } catch (error) {
        const err = error as Error;
        
        // Check if token is invalid
        if (err.message.includes('registration-token-not-registered')) {
          // Remove invalid token from UserSettings
          await getFirestore().collection(COLLECTIONS.USER_SETTINGS).doc(userID)
            .update({ 'notification.fcmToken': admin.firestore.FieldValue.delete() });
          logger.warn(`Removed invalid FCM token for user ${userID}`);
          // Continue to SMS fallback
        } else {
          logger.error(`Error sending FCM notification to user ${userID}: ${err.message}`);
          // Continue to SMS fallback
        }
      }
    }

    // Fallback to SMS if FCM failed or no token available
    // Get user contact info from UserInfo collection
    const userInfoRef = getFirestore().collection(COLLECTIONS.USER_INFO).doc(userID);
    const userInfoDoc = await userInfoRef.get();
    
    if (!userInfoDoc.exists) {
      return { success: false, reason: 'User contact info not found' };
    }
    
    const userInfo = userInfoDoc.data() as UserInfo;
    const phoneNumber = userInfo.contact?.phoneNumber;
    
    if (phoneNumber) {
      try {
        const telnyxClient = await initTelnyx();
        
        const messageRequest: Telnyx.MessagesCreateOptionalParams = {
          from: '+18449932201',
          to: phoneNumber,
          text: `${title}\n\n${message}`,
          use_profile_webhooks: false,
          auto_detect: false
        };

        const telnyxResponse = await telnyxClient.messages.create(messageRequest);
        logger.info(`SMS notification sent to user ${userID}, message id: ${telnyxResponse.data?.id}`);
        
        // Log successful SMS notification
        await logNotificationSent(userID, title, 'sms');
        
        return { success: true };
      } catch (error) {
        logger.error(`Error sending SMS notification to user ${userID}: ${(error as Error).message}`);
        return { success: false, reason: 'SMS delivery failed' };
      }
    }
    
    // No notification channels available
    logger.warn(`No notification channels available for user ${userID}`);
    return { success: false, reason: 'No notification channels available' };
  }

  /**
   * Logs a successful notification in the audit logs
   * @param userID - The user who received the notification
   * @param title - The notification title
   * @param channel - The channel used (fcm or sms)
   */
  async function logNotificationSent(userID: string, title: string, channel: 'fcm' | 'sms'): Promise<void> {
    try {
      await getFirestore().collection(COLLECTIONS.AUDIT_LOGS).add({
        type: 'notification_sent',
        userId: userID,
        details: {
          notificationType: title,
          channel: channel
        },
        createdAt: Timestamp.now()
      });
    } catch (error) {
      // Don't fail if logging fails
      logger.warn(`Failed to log notification in audit logs: ${(error as Error).message}`);
    }
  }
});

/**
 * Finds an active LiveKit room that contains the specified user
 * @param roomService - The LiveKit room service client
 * @param userId - The user ID to find in rooms
 * @returns Promise resolving to the Room if found, undefined otherwise
 */
async function getActiveRoom(roomService: RoomServiceClient, userId: string): Promise<Room | undefined> {
  try {
    logger.info(`Searching for active room containing user ${userId}`);
    const rooms = await roomService.listRooms();
    
    if (!rooms || rooms.length === 0) {
      logger.info('No active LiveKit rooms found');
      return undefined;
    }
    
    logger.info(`Found ${rooms.length} active LiveKit rooms`);
    
    // Search each room for the user
    for (const room of rooms) {
      try {
        const participants = await roomService.listParticipants(room.name);
        const userFound = participants.some(p => p.identity === userId);
        
        if (userFound) {
          logger.info(`Found user ${userId} in room ${room.name}`);
          return room;
        }
      } catch (err) {
        // Continue checking other rooms if one fails
        logger.warn(`Error checking participants in room ${room.name}: ${(err as Error).message}`);
      }
    }
    
    // User not found in any room
    logger.info(`User ${userId} not found in any active room`);
    return undefined;
  } catch (error) {
    // Log error but don't throw to prevent disrupting the caller
    logger.error(`Error searching for active LiveKit room: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Finds the AI agent participant in a specified LiveKit room
 * @param roomService - The LiveKit room service client
 * @param roomName - The name of the room to search in
 * @returns Promise resolving to the agent ParticipantInfo if found, undefined otherwise
 */
async function getAgentParticipant(roomService: RoomServiceClient, roomName: string): Promise<ParticipantInfo | undefined> {
  try {
    logger.info(`Searching for agent in room ${roomName}`);
    const participants = await roomService.listParticipants(roomName);
    
    if (!participants || participants.length === 0) {
      logger.info(`No participants found in room ${roomName}`);
      return undefined;
    }
    
    logger.info(`Found ${participants.length} participants in room ${roomName}`);
    
    // Find the agent participant (kind 4 represents the agent)
    const agentParticipant = participants.find(p => p.kind === 4);
    
    if (agentParticipant) {
      logger.info(`Found agent ${agentParticipant.identity} in room ${roomName}`);
      return agentParticipant;
    }
    
    // Agent not found
    logger.info(`No agent found in room ${roomName}`);
    return undefined;
  } catch (error) {
    // Log error but don't throw to prevent disrupting the caller
    logger.error(`Error finding agent in room ${roomName}: ${(error as Error).message}`);
    return undefined;
  }
}

/**
 * Retrieves a user's profile information from Firestore
 * @param userID - The ID of the user to retrieve
 * @returns Promise resolving to the UserInfo object
 * @throws Error if the user profile is not found
 */
async function getUserProfile(userID: string): Promise<UserInfo> {
  if (!userID) {
    const error = new Error("User ID is required");
    logger.error("User ID not provided when retrieving user profile", { error });
    throw error;
  }

  logger.info(`Retrieving user profile for userID: ${userID}`);
  const profileRef = getFirestore().doc(`${COLLECTIONS.USER_INFO}/${userID}`);
  
  try {
    const profileDoc = await profileRef.get();
    
    if (!profileDoc.exists) {
      const error = new Error(`User profile not found for userID: ${userID}`);
      logger.error(error.message, { userID });
      throw error;
    }
    
    const userData = profileDoc.data();
    if (!userData) {
      const error = new Error(`User profile exists but has no data for userID: ${userID}`);
      logger.error(error.message, { userID });
      throw error;
    }
    
    logger.info(`Successfully retrieved user profile for userID: ${userID}`);
    return { 
      id: userID, 
      ...userData 
    } as UserInfo;
  } catch (error) {
    // Capture and rethrow non-existence errors for better tracking
    if ((error as Error).message.includes('not found')) {
      throw error;
    }
    
    const err = new Error(`Failed to retrieve user profile: ${(error as Error).message}`);
    logger.error(err.message, { userID, originalError: error });
    throw err;
  }
}

/**
 * Retrieves a wali's profile information from Firestore
 * @param waliID - The ID of the wali to retrieve
 * @returns Promise resolving to the WaliInfo object
 * @throws Error if the wali profile is not found
 */
async function getWaliProfile(waliID: string): Promise<WaliInfo> {
  if (!waliID) {
    const error = new Error("Wali ID is required");
    logger.error("Wali ID not provided when retrieving wali profile", { error });
    throw error;
  }

  logger.info(`Retrieving wali profile for waliID: ${waliID}`);
  const profileRef = getFirestore().doc(`${COLLECTIONS.WALI_INFO}/${waliID}`);
  
  try {
    const profileDoc = await profileRef.get();
    
    if (!profileDoc.exists) {
      const error = new Error(`Wali profile not found for waliID: ${waliID}`);
      logger.error(error.message, { waliID });
      throw error;
    }
    
    const waliData = profileDoc.data();
    if (!waliData) {
      const error = new Error(`Wali profile exists but has no data for waliID: ${waliID}`);
      logger.error(error.message, { waliID });
      throw error;
    }
    
    logger.info(`Successfully retrieved wali profile for waliID: ${waliID}`);
    return waliData as WaliInfo;
  } catch (error) {
    // Capture and rethrow non-existence errors for better tracking
    if ((error as Error).message.includes('not found')) {
      throw error;
    }
    
    const err = new Error(`Failed to retrieve wali profile: ${(error as Error).message}`);
    logger.error(err.message, { waliID, originalError: error });
    throw err;
  }
}

/**
 * Initializes and returns a Telnyx client for SMS messaging
 * @returns Promise resolving to a configured Telnyx client
 * @throws Error if the client cannot be initialized
 */
const initTelnyx = async () => {
  try {
    logger.info("Initializing Telnyx client for SMS messaging");
    
    // Retrieve the API key from Secret Manager
    const apiKey = await accessSecret(ApiKeys.TELNYX_API_KEY);
    if (!apiKey) {
      const error = new Error("Failed to retrieve Telnyx API key");
      logger.error(error.message);
      throw error;
    }
    
    // Import the Telnyx module dynamically
    const TelnyxModule = await import('telnyx');
    
    // Initialize the client with the API key
    const telnyx = new TelnyxModule.default(apiKey);
    
    logger.info("Telnyx client initialized successfully");
    return telnyx;
  } catch (error) {
    const err = new Error(`Failed to initialize Telnyx client: ${(error as Error).message}`);
    logger.error(err.message, { originalError: error });
    throw err;
  }
};