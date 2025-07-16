// navigation/types.ts

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: {
    tempUser: {
      uid: string;
      name: string;
      email: string;
      photoURL?: string;
      createdAt?: any;
      onboardingCompleted: boolean;
    };
  };
};

export type AuthStackParamList = {
  Login: undefined;
  Splash: undefined;
};

export type MainTabsParamList = {
  Home: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatDetail: { chatName?: string };
};

export type HomeStackParamList = {
  Home: undefined;
  ChatDetail: { chatName?: string };
};
