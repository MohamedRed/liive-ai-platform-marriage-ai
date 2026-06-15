import { onCall } from "firebase-functions/v2/https";

// Super minimal test function with absolutely minimal dependencies
exports.superMinimalTest = onCall(
  { 
    region: 'us-central1',
    memory: '128MiB'
  }, 
  async (request) => {
    // Return simple response with no external dependencies used
    return { success: true, message: "Super minimal test function executed successfully" };
  }
); 