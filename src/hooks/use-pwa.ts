import { useEffect, useState } from 'react';
// The virtual module is created by the vite-plugin-pwa
// @ts-ignore - virtual module created by vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register';

export function usePWA() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Handle PWA registration
  useEffect(() => {
    // Skip if not in browser environment
    if (typeof window === 'undefined') return;

    const updateSW = registerSW({
      onNeedRefresh() {
        setIsUpdateAvailable(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
      onRegistered(r: ServiceWorkerRegistration | undefined) {
        console.log('Service Worker registered:', r);
        if (r) {
          setRegistration(r);
          // Check for updates periodically (every 60 minutes)
          setInterval(() => {
            r.update().catch(console.error);
          }, 60 * 60 * 1000);
        }
      },
      onRegisterError(error: Error) {
        console.error('Service Worker registration error:', error);
      },
    });

    // Close update notification after 10 seconds
    const timer = setTimeout(() => {
      if (offlineReady) {
        setOfflineReady(false);
      }
    }, 10000);

    return () => {
      clearTimeout(timer);
      updateSW();
    };
  }, [offlineReady]);

  // Function to update the service worker
  const updateServiceWorker = () => {
    if (isUpdateAvailable) {
      window.location.reload();
    }
  };

  return {
    isUpdateAvailable,
    offlineReady,
    updateServiceWorker,
    registration,
  };
}

export default usePWA; 