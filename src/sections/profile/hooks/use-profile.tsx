import {collection, query, where} from "firebase/firestore";
import {useFirestore, useFirestoreCollectionData} from "reactfire";
import {useMemo} from "react";
import {useAuthContext} from "../../../auth/hooks";


export function useProfile() {
  const {user} = useAuthContext()
  const firestore = useFirestore();
  const chatsCollection = collection(firestore, 'PROFILES');
  const chatsQuery = query(chatsCollection, where('userID', '==', user.id));

  const { status, error, data } = useFirestoreCollectionData(chatsQuery, {idField: 'docID'});

  const isLoading = status==='loading'

  const memoizedValue = useMemo(() => ({
      profile: data,
      profileLoading: isLoading,
      profileError: error,
      profileEmpty: !isLoading,
    }), [data, error, isLoading]);

  return memoizedValue;
}
