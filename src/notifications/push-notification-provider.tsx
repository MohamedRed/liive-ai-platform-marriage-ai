import { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { useFirebaseApp } from 'reactfire';
import { getMessaging, onMessage, getToken } from 'firebase/messaging';
import { CONFIG } from 'src/config-global';
import { getFirestore, doc, setDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { useAuthContext } from 'src/auth/hooks';

// Define the context type
type PushNotificationContextType = {
  permission: NotificationPermission;
  isSupported: boolean;
};

// Create context with type and default value
const PushNotificationContext = createContext<PushNotificationContextType>({ 
  permission: 'default',
  isSupported: false
});

// Helper function to check if FCM is supported in this browser
const isFCMSupported = () => {
  // Check for service worker, notification, and other required features
  return (
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window &&
    'getToken' in window.indexedDB
  );
};

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Custom hook to use the Push Notification context
export const usePushNotification = () => {
  return useContext(PushNotificationContext);
};

// Push Notification Provider component
export const PushNotificationProvider = ({ children }: PropsWithChildren) => {
  const firebaseApp = useFirebaseApp();
  const { user } = useAuthContext();
  const firestore = getFirestore(firebaseApp);
  const [permission, setPermission] = useState<NotificationPermission>(
    isBrowser && 'Notification' in window ? Notification.permission : 'default'
  );
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [messaging, setMessaging] = useState<any>(null);

  // Initialize messaging only if supported
  useEffect(() => {
    const checkSupport = async () => {
      const supported = isFCMSupported();
      setIsSupported(supported);
      
      if (supported) {
        try {
          const messagingInstance = getMessaging(firebaseApp);
          setMessaging(messagingInstance);
        } catch (error) {
          console.error('Error initializing Firebase Messaging:', error);
          setIsSupported(false);
        }
      }
    };
    
    checkSupport();
  }, [firebaseApp]);

  useEffect(() => {
    // Only proceed if messaging is supported and initialized
    if (!isSupported || !messaging) return;

    // Request permission to send notifications
    const requestNotificationPermission = async () => {
      try {
        const permissionResult = await Notification.requestPermission();
        setPermission(permissionResult);
        console.log('Notification permission:', permissionResult);
      } catch (error) {
        console.error('Unable to get permission to notify.', error);
      }
    };

    if (permission !== 'granted') {
      requestNotificationPermission();
    }

    // Handle incoming messages
    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Message received. ', payload);

        if (payload.notification?.title && payload.notification?.body) {
          if (document.visibilityState === 'visible') {
            // App is in the foreground, update the UI directly
            alert(`New match update: ${payload.notification.body}`);
          } else {
            // App is in the background, let the notification be displayed
            new Notification(payload.notification.title, {
              body: payload.notification.body,
            });
          }
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up message handler:', error);
      return () => {};
    }
  }, [messaging, permission, isSupported]);

  useEffect(() => {
    // Only proceed if FCM is supported, messaging is initialized, and user is authenticated
    if (!isSupported || !messaging || !user?.uid) return;

    const getFCMToken = async () => {
      try {
        const token = await getToken(messaging, { vapidKey: CONFIG.firebase.vapidKey });
        if (token) {
          // Save the token to Firestore
          await setDoc(doc(firestore, 'USERS', user.uid), {
            fcmToken: token,
            updatedAt: new Date(),
          }, { merge: true });
          console.log('FCM Token saved:', token);
        }
      } catch (error) {
        console.error('Error getting/saving FCM token:', error);
        setIsSupported(false);
      }
    };

    getFCMToken();
  }, [messaging, user?.uid, isSupported, firestore]);

  return (
    <PushNotificationContext.Provider value={{ permission, isSupported }}>
      {children}
    </PushNotificationContext.Provider>
  );
};

export default PushNotificationProvider;