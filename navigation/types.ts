export type RootStackParamList = {
    Auth: undefined;
    Main: undefined; // your MainTabs navigator
  };
  
  export type AuthStackParamList = {
    Splash: undefined;
    Login: undefined;
    Onboarding: undefined;
  };
  
  export type MainTabsParamList = {
    Home: undefined;
    Chats: undefined;
    Profile: undefined;
  };
  
  export type ChatStackParamList = {
    ChatList: undefined;
    ChatDetail: { chatId: string; chatName: string };
  };
  