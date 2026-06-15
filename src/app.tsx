import 'src/global.css';

// ----------------------------------------------------------------------
import {FirebaseAppProvider} from "reactfire";
import { useEffect } from 'react';

import {Router} from 'src/routes/sections';

import {useScrollToTop} from 'src/hooks/use-scroll-to-top';

import {CONFIG} from 'src/config-global';
import {LocalizationProvider} from 'src/locales';
import {I18nProvider} from 'src/locales/i18n-provider';
import {ThemeProvider} from 'src/theme/theme-provider';

import {Snackbar} from 'src/components/snackbar';
import {ProgressBar} from 'src/components/progress-bar';
import {MotionLazy} from 'src/components/animate/motion-lazy';
import {SettingsDrawer, defaultSettings, SettingsProvider} from 'src/components/settings';
import PWAUpdateNotification from 'src/components/pwa-update-notification';

import {CheckoutProvider} from 'src/sections/checkout/context';

import {AuthProvider as JwtAuthProvider} from 'src/auth/context/jwt';
import {AuthProvider as Auth0AuthProvider} from 'src/auth/context/auth0';
import {AuthProvider as AmplifyAuthProvider} from 'src/auth/context/amplify';
import {AuthProvider as SupabaseAuthProvider} from 'src/auth/context/supabase';
import {AuthProvider as FirebaseAuthProvider} from 'src/auth/context/firebase';

import {ConnectionProvider} from "src/hooks/use-connection";
import {PlaygroundStateProvider} from "src/hooks/use-playground-state";
import { PushNotificationProvider } from 'src/notifications/push-notification-provider';
import { registerServiceWorker } from 'src/register-service-worker';
// ----------------------------------------------------------------------

const AuthProvider =
  (CONFIG.auth.method === 'amplify' && AmplifyAuthProvider) ||
  (CONFIG.auth.method === 'firebase' && FirebaseAuthProvider) ||
  (CONFIG.auth.method === 'supabase' && SupabaseAuthProvider) ||
  (CONFIG.auth.method === 'auth0' && Auth0AuthProvider) ||
  JwtAuthProvider;

export default function App() {
  useScrollToTop();

  // Register service worker
  useEffect(() => {
    if (CONFIG.auth.method === 'firebase') {
      registerServiceWorker().catch(console.error);
    }
  }, []);

  return (
    <I18nProvider>
      <LocalizationProvider>
        <AuthProvider>
          <FirebaseAppProvider firebaseConfig={CONFIG.firebase}>
            <SettingsProvider settings={defaultSettings}>
              <PushNotificationProvider>
              <PlaygroundStateProvider>
                <ConnectionProvider>
                  <ThemeProvider>
                    <MotionLazy>
                      <CheckoutProvider>
                        <Snackbar/>
                        <ProgressBar/>
                        <SettingsDrawer/>
                        <PWAUpdateNotification />
                        <Router/>
                      </CheckoutProvider>
                    </MotionLazy>
                  </ThemeProvider>
                </ConnectionProvider>
              </PlaygroundStateProvider>
              </PushNotificationProvider>
            </SettingsProvider>
          </FirebaseAppProvider>
        </AuthProvider>
      </LocalizationProvider>
    </I18nProvider>
  );
}
