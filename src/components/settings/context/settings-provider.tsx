import {getFunctions} from "@firebase/functions";
import {getFirestore} from "@firebase/firestore";
import {useMemo, useState, useCallback, createContext} from 'react';
import {useFirebaseApp, FirestoreProvider, FunctionsProvider} from "reactfire";

import {useLocalStorage} from 'src/hooks/use-local-storage';

import {STORAGE_KEY} from '../config-settings';

import type {SettingsState, SettingsContextValue, SettingsProviderProps} from '../types';


// ----------------------------------------------------------------------

export const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsConsumer = SettingsContext.Consumer;

// ----------------------------------------------------------------------

export function SettingsProvider({ children, settings }: SettingsProviderProps) {

  const app = useFirebaseApp()
  const functionsInstance = getFunctions(app);
  const firestoreInstance = getFirestore(app);

  const values = useLocalStorage<SettingsState>(STORAGE_KEY, settings);

  const [openDrawer, setOpenDrawer] = useState(false);

  const onToggleDrawer = useCallback(() => {
    setOpenDrawer((prev) => !prev);
  }, []);

  const onCloseDrawer = useCallback(() => {
    setOpenDrawer(false);
  }, []);

  const memoizedValue = useMemo(
    () => ({
      ...values.state,
      canReset: values.canReset,
      onReset: values.resetState,
      onUpdate: values.setState,
      onUpdateField: values.setField,
      openDrawer,
      onCloseDrawer,
      onToggleDrawer,
    }),
    [
      values.state,
      values.canReset,
      values.resetState,
      values.setState,
      values.setField,
      openDrawer,
      onCloseDrawer,
      onToggleDrawer,
    ]
  );

  return (<FirestoreProvider sdk={firestoreInstance}>
      <FunctionsProvider sdk={functionsInstance}>
    <SettingsContext.Provider value={memoizedValue}>{children}</SettingsContext.Provider>
      </FunctionsProvider>
    </FirestoreProvider>);
}
