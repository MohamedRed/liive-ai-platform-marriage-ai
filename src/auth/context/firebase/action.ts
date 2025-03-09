import {doc, setDoc, collection} from 'firebase/firestore';
import {
  getAuth,
  signOut as _signOut,
  signInWithPopup as _signInWithPopup,
  GithubAuthProvider as _GithubAuthProvider,
  GoogleAuthProvider as _GoogleAuthProvider,
  TwitterAuthProvider as _TwitterAuthProvider,
  signInWithCredential as _signInWithCredential,
  sendEmailVerification as _sendEmailVerification,
  signInWithPhoneNumber as _signInWithPhoneNumber,
  sendPasswordResetEmail as _sendPasswordResetEmail,
  signInWithEmailAndPassword as _signInWithEmailAndPassword,
  createUserWithEmailAndPassword as _createUserWithEmailAndPassword,
} from 'firebase/auth';

import {AUTH, FIRESTORE} from 'src/lib/firebase';

// ----------------------------------------------------------------------

export type SignInParams = {
  email: string;
  password: string;
};

export type SignUpParams = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type ForgotPasswordParams = {
  email: string;
};

export type PhoneSignInParams = {
  phoneNumber: string;
  verificationCode?: string; // Optional for later verification
};

/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({ email, password }: SignInParams): Promise<void> => {
  try {
    await _signInWithEmailAndPassword(AUTH, email, password);

    const user = AUTH.currentUser;

    if (!user?.emailVerified) {
      throw new Error('Email not verified!');
    }
  } catch (error) {
    console.error('Error during sign in with password:', error);
    throw error;
  }
};

export const signInWithGoogle = async (): Promise<void> => {
  const provider = new _GoogleAuthProvider();
  await _signInWithPopup(AUTH, provider);
};

export const signInWithGithub = async (): Promise<void> => {
  const provider = new _GithubAuthProvider();
  await _signInWithPopup(AUTH, provider);
};

export const signInWithTwitter = async (): Promise<void> => {
  const provider = new _TwitterAuthProvider();
  await _signInWithPopup(AUTH, provider);
};

export const signInWithPhoneNumber = async ({ phoneNumber }: PhoneSignInParams): Promise<string> => {
  const auth = getAuth();

  try {
    // Request SMS code
    const confirmationResult = await _signInWithPhoneNumber(auth, phoneNumber, appVerifier);

    // Return the verification ID for later use
    return confirmationResult.verificationId;
  } catch (error) {
    console.error("Error during phone sign-in:", error);
    throw error;
  }
};

export const verifyPhoneNumber = async (verificationId: string, verificationCode: string): Promise<void> => {
  const auth = getAuth();

  try {
    const credential = auth.PhoneAuthProvider.credential(verificationId, verificationCode);
    const userCredential = await _signInWithCredential(auth, credential);
  } catch (error) {
    console.error("Error during phone number verification:", error);
    throw error;
  }
};


/** **************************************
 * Sign up
 *************************************** */
export const signUp = async ({
  email,
  password,
  firstName,
  lastName,
}: SignUpParams): Promise<void> => {
  try {
    const newUser = await _createUserWithEmailAndPassword(AUTH, email, password);

    /*
     * (1) If skip emailVerified
     * Remove : await _sendEmailVerification(newUser.user);
     */
    await _sendEmailVerification(newUser.user);

    const userProfile = doc(collection(FIRESTORE, 'users'), newUser.user?.uid);

    await setDoc(userProfile, {
      uid: newUser.user?.uid,
      email,
      displayName: `${firstName} ${lastName}`,
    });
  } catch (error) {
    console.error('Error during sign up:', error);
    throw error;
  }
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async (): Promise<void> => {
  await _signOut(AUTH);
};

/** **************************************
 * Reset password
 *************************************** */
export const sendPasswordResetEmail = async ({ email }: ForgotPasswordParams): Promise<void> => {
  await _sendPasswordResetEmail(AUTH, email);
};
