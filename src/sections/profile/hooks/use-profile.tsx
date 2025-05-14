import { doc, WithFieldValue, getDoc } from "firebase/firestore";
import { useFirestore } from "reactfire";
import { useMemo, useState, useEffect } from "react";
import { useAuthContext } from "../../../auth/hooks";
import { COLLECTIONS, UserInfo, QuestionsAnswers } from '@livve-1/database-types';

const userInfoConverter = {
  toFirestore: (info: WithFieldValue<UserInfo>) => info,
  fromFirestore: (snap: any): UserInfo => snap.data() as UserInfo,
};
const qasConverter = {
  toFirestore: (qas: WithFieldValue<QuestionsAnswers>) => qas,
  fromFirestore: (snap: any): QuestionsAnswers => snap.data() as QuestionsAnswers,
};

export function useProfile() {
  const { user } = useAuthContext();
  const firestore = useFirestore();

  const [userInfoData, setUserInfoData] = useState<UserInfo | null>(null);
  const [qasData, setQasData] = useState<QuestionsAnswers | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const userId = user?.id;
      if (!userId) {
        setUserInfoData(null);
        setQasData(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const userInfoRef = doc(firestore, COLLECTIONS.USERS.USER_INFO, userId).withConverter(userInfoConverter);
        const userInfoSnap = await getDoc(userInfoRef);
        setUserInfoData(userInfoSnap.exists() ? userInfoSnap.data() : null);

        const qasRef = doc(firestore, COLLECTIONS.MARRIAGE.QUESTIONS_ANSWERS, userId).withConverter(qasConverter);
        const qasSnap = await getDoc(qasRef);
        setQasData(qasSnap.exists() ? qasSnap.data() : null);

      } catch (err) {
        console.error("Error fetching profile data:", err);
        setError(err instanceof Error ? err : new Error('Failed to fetch profile data'));
        setUserInfoData(null);
        setQasData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, firestore]);

  const memoizedValue = useMemo(() => ({
      userInfo: userInfoData,
      qas: qasData,
      profileLoading: isLoading,
      profileError: error,
      profileEmpty: !isLoading && !userInfoData && !qasData,
    }), [userInfoData, qasData, error, isLoading]);

  return memoizedValue;
}
