/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import { AppTheme } from './screens/themes/theme';
import AppNavigator from './navigation/AppNavigator';
import { useEffect, useState } from 'react';
import { initializeFirebase } from './services/FirebaseConfig';
import { View } from 'react-native';
import useAuthStore from './store/auth.store';

function App() {
  const loadUserFromStorage = useAuthStore((state) => state.loadUserFromStorage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserFromStorage().finally(() => setLoading(false));
  }, [loadUserFromStorage]);

  
  useEffect(() => {
    initializeFirebase();
  }, []);
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF4B7B" />
      </View>
    );
  }
  return (
    <PaperProvider theme={AppTheme}>
      <AppNavigator/>
    </PaperProvider>
  );
}

export default App;
