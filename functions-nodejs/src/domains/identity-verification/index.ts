import { onCall, onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from 'firebase-admin';
import { firestore } from "firebase-admin";
import Stripe from "stripe";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

import { 
  IdentityVerification,
  UserIdentityVerification,
  WaliIdentityVerification,
  VerificationStatus,
  StripeOutputsType,
  LEGACY_COLLECTIONS
} from '@livve-1/database-types';

// Secret keys enum
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

/**
 * Access a secret from Secret Manager
 */
async function accessSecret(name: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name,
  });
  
  const payload = version.payload!.data!.toString();
  return payload;
}

/**
 * Stripe Identity Webhook Handler
 */
export const stripeIdentityWebhook = onRequest(async (request, response) => {
  const stripe = new Stripe(await accessSecret(ApiKeys.STRIPE_API_KEY), {telemetry: false});
  const stripeIdentityWebhookSecret = await accessSecret(ApiKeys.STRIPE_IDENTITY_WEBHOOK);

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
    return;
  }

  switch (event!.type) {
    case "identity.verification_session.created":
    case "identity.verification_session.processing":
    case "identity.verification_session.verified":
    case "identity.verification_session.requires_input":
    case "identity.verification_session.canceled":
    case "identity.verification_session.redacted": {
      const identityVerificationSession: Stripe.Identity.VerificationSession = event.data.object;
      const userID = identityVerificationSession.client_reference_id;
      const eventTimestamp = event.created;

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
});

/**
 * Update identity verification status
 */
async function updateIDVerificationStatus(
  userID: string,
  eventTimestamp: number,
  identityVerificationSession: Stripe.Identity.VerificationSession
) {
  // Using legacy collections until migration to separate databases is complete
  const db = admin.firestore();
  const timestamp = firestore.Timestamp.fromMillis(eventTimestamp);

  // Determine if the user is a Wali
  const waliDoc = await db.collection(LEGACY_COLLECTIONS.WALI_INFO).doc(userID).get();
  const isWali = waliDoc.exists;

  // Get existing verification data if any
  const verificationDoc = await db
    .collection(LEGACY_COLLECTIONS.IDENTITY_VERIFICATIONS)
    .doc(userID)
    .get();

  // Common verification fields
  const commonFields = {
    provider: 'stripe',
    sessionId: identityVerificationSession.id,
    status: identityVerificationSession.status as unknown as VerificationStatus,
    verificationMetadata: {
      attempts: verificationDoc.exists 
        ? ((verificationDoc.data() as IdentityVerification)?.verificationMetadata?.attempts || 0) + 1 
        : 1
    },
    createdAt: verificationDoc.exists 
      ? (verificationDoc.data() as IdentityVerification)?.createdAt 
      : timestamp,
    updatedAt: timestamp
  };

  // Prepare verification data based on user type
  const verificationData = isWali
    ? { 
        ...commonFields,
        waliId: userID 
      } as WaliIdentityVerification
    : { 
        ...commonFields,
        userId: userID 
      } as UserIdentityVerification;

  // Update verification status
  await db
    .collection(LEGACY_COLLECTIONS.IDENTITY_VERIFICATIONS)
    .doc(userID)
    .set(verificationData, { merge: true });

  logger.info(`Identity verification status updated for ${userID}`, {
    status: identityVerificationSession.status,
    sessionId: identityVerificationSession.id
  });
}

/**
 * Create Stripe identity verification session
 */
export const createIdentityVerificationSession = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("Unauthorized. You must be logged in to verify identity.");
  }

  const userID = request.auth.uid;
  const isProvidedWaliInfo = request.data?.isProvidedWaliInfo || false;

  try {
    // Initialize Stripe
    const stripe = new Stripe(await accessSecret(ApiKeys.STRIPE_API_KEY), {telemetry: false});
    const identityFlowId = await accessSecret(ApiKeys.STRIPE_IDENTITY_FLOW);
    
    // Create verification session
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      options: {
        document: {
          require_id_number: true,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      metadata: {
        user_id: userID,
        is_wali: isProvidedWaliInfo ? 'true' : 'false'
      },
      return_url: `https://yourdomain.com/account?verification_status={STATUS}`,
      client_reference_id: userID,
      verification_flow: identityFlowId
    });
    
    // Using legacy collections until migration to separate databases is complete
    const db = admin.firestore();
    const _timestamp = firestore.Timestamp.now();
    
    // Get existing verification data if any
    const verificationDoc = await db
      .collection(LEGACY_COLLECTIONS.IDENTITY_VERIFICATIONS)
      .doc(userID)
      .get();
    
    // Common verification fields
    const commonFields = {
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

    // Prepare verification data based on user type
    const verificationData = isProvidedWaliInfo
      ? { 
          ...commonFields,
          waliId: userID 
        } as WaliIdentityVerification
      : { 
          ...commonFields,
          userId: userID 
        } as UserIdentityVerification;
    
    // Save verification data
    await db
      .collection(LEGACY_COLLECTIONS.IDENTITY_VERIFICATIONS)
      .doc(userID)
      .set(verificationData, { merge: true });

    return {
      url: verificationSession.url
    };
  } catch (error) {
    logger.error(`Error creating identity verification session for ${userID}:`, error);
    throw new Error("Failed to create identity verification session");
  }
});

/**
 * Get verification outputs from Stripe
 */
export async function getVerificationOutputs(sessionID: string): Promise<StripeOutputsType> {
  try {
    // Initialize Stripe
    const stripe = new Stripe(await accessSecret(ApiKeys.STRIPE_API_KEY), {telemetry: false});
    
    // Retrieve verification session
    const session = await stripe.identity.verificationSessions.retrieve(
      sessionID,
      { expand: ['verified_outputs'] }
    );
    
    if (!session.verified_outputs) {
      return {};
    }
    
    // Extract and return outputs
    return session.verified_outputs as unknown as StripeOutputsType;
  } catch (error) {
    logger.error(`Error getting verification outputs for session ${sessionID}:`, error);
    return {};
  }
} 