// src/services/FirebaseConfig.ts
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export function initializeFirebase() {
  GoogleSignin.configure({
    webClientId: '945322319364-fajiklk92udctib0o8p4cgfp5la1jqk3.apps.googleusercontent.com',
  });
}

export { auth, GoogleSignin };
