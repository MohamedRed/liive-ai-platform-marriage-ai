import { CONFIG } from './config-global';

export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });

      // Pass Firebase config to service worker
      if (registration.active) {
        // These will be available to the service worker via self.FIREBASE_*
        registration.active.postMessage({
          type: 'FIREBASE_CONFIG',
          config: {
            FIREBASE_API_KEY: CONFIG.firebase.apiKey,
            FIREBASE_AUTH_DOMAIN: CONFIG.firebase.authDomain,
            FIREBASE_PROJECT_ID: CONFIG.firebase.projectId,
            FIREBASE_STORAGE_BUCKET: CONFIG.firebase.storageBucket,
            FIREBASE_MESSAGING_SENDER_ID: CONFIG.firebase.messagingSenderId,
            FIREBASE_APP_ID: CONFIG.firebase.appId,
            FIREBASE_MEASUREMENT_ID: CONFIG.firebase.measurementId
          }
        });
      }

      console.log('Firebase Messaging Service Worker registered successfully:', registration);
      return registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      return null;
    }
  } else {
    console.warn('Service workers are not supported in this browser');
    return null;
  }
};

export default registerServiceWorker; 