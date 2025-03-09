// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Store Firebase config values
let firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

// Listen for messages from the main app with configuration
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    const config = event.data.config;
    
    // Update Firebase config values
    firebaseConfig = {
      apiKey: config.FIREBASE_API_KEY || "",
      authDomain: config.FIREBASE_AUTH_DOMAIN || "",
      projectId: config.FIREBASE_PROJECT_ID || "",
      storageBucket: config.FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: config.FIREBASE_MESSAGING_SENDER_ID || "",
      appId: config.FIREBASE_APP_ID || "",
      measurementId: config.FIREBASE_MEASUREMENT_ID || ""
    };
    
    // Re-initialize Firebase with the new config
    initializeFirebase();
  }
});

// Initialize Firebase with the current config
function initializeFirebase() {
  // If Firebase is already initialized, delete the app first
  if (firebase.apps.length > 0) {
    firebase.app().delete().then(() => {
      firebase.initializeApp(firebaseConfig);
      initializeMessaging();
    });
  } else {
    firebase.initializeApp(firebaseConfig);
    initializeMessaging();
  }
}

// Initialize Firebase Messaging
function initializeMessaging() {
  try {
    // Retrieve an instance of Firebase Messaging
    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      // Customize notification here
      const notificationTitle = payload.notification?.title || 'New Message';
      const notificationOptions = {
        body: payload.notification?.body || 'New message received',
        icon: '/favicon.ico'
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error initializing messaging:', error);
  }
}

// Initial Firebase initialization
initializeFirebase();

// Service worker lifecycle events
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activated');
  event.waitUntil(clients.claim());
});
