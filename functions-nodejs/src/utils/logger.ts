import { logger as firebaseLogger } from "firebase-functions";

/**
 * Logger utility that wraps Firebase Functions logger
 * This provides a consistent interface and allows for future enhancements
 */
export const logger = {
  info: (message: string, data?: any) => {
    firebaseLogger.info(message, data);
  },
  
  error: (message: string, error?: any) => {
    firebaseLogger.error(message, error);
  },
  
  warn: (message: string, data?: any) => {
    firebaseLogger.warn(message, data);
  },
  
  debug: (message: string, data?: any) => {
    firebaseLogger.debug(message, data);
  }
}; 