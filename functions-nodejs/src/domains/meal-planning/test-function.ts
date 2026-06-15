import { onCall } from "firebase-functions/v2/https";

// Minimal test function to verify deployment
exports.minimalTestFunction = onCall(
  { 
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60
  },
  async (request) => {
    return { 
      success: true,
      message: "Minimal test function executed successfully",
      timestamp: new Date().toISOString()
    };
  }
); 