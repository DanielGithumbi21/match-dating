import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Dimensions
} from 'react-native';
import useAuthStore from '../store/auth.store';
import { auth, GoogleSignin } from '../services/FirebaseConfig';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { Colors } from './themes/color';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/types';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const setUser = useAuthStore((state) => state.setUser);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn();
      
      if (!data?.idToken) {
        throw new Error('No ID token received from Google');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(data.idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      
      if (!userCredential.user) {
        throw new Error('Authentication failed');
      }

      const userRef = firestore().collection('users').doc(userCredential.user.uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists()) {
        // ✅ Existing user → load their profile
        const userData = userDoc.data();
        setUser({ 
          uid: userCredential.user.uid, 
          ...userData 
        });
        
        // Navigate to main app or check if onboarding is complete
        // You might want to check if user has completed onboarding here
        // For now, assuming they go to main app
        
      } else {
        // 🆕 New user → save basic info, then go to Onboarding
        const newUserData = {
          name: userCredential.user.displayName || 'User',
          email: userCredential.user.email || '',
          photoURL: userCredential.user.photoURL || '',
          createdAt: firestore.FieldValue.serverTimestamp(),
          onboardingCompleted: false, // Track onboarding status
        };

        await userRef.set(newUserData);

        setUser({
          uid: userCredential.user.uid,
          ...newUserData,
        });

        // Use replace instead of navigate to prevent going back to login
        navigation.replace('Onboarding');
      }

    } catch (error) {
      console.error('Google Sign-In error:', error);
      Alert.alert(
        'Sign In Error',
        'There was a problem signing you in. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Brand Section */}
        <View style={styles.brandSection}>
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>YM</Text>
          </View>
          <Text style={styles.title}>You Match</Text>
          <Text style={styles.subtitle}>
            Connect with like-minded people and discover meaningful relationships
          </Text>
        </View>

        {/* Sign In Section */}
        <View style={styles.signInSection}>
          <Text style={styles.signInTitle}>Get Started</Text>
          
          {/* Google Sign In Button */}
          <TouchableOpacity 
            style={styles.googleButtonContainer}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loadingText}>Signing in...</Text>
              </View>
            ) : (
              <GoogleSigninButton
                style={styles.googleButton}
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Dark}
                onPress={handleLogin}
                disabled={isLoading}
              />
            )}
          </TouchableOpacity>

          {/* Alternative sign in options placeholder */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email sign in option (placeholder) */}
          <TouchableOpacity style={styles.emailButton} disabled>
            <Text style={styles.emailButtonText}>Continue with Email</Text>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our{' '}
            <Text style={styles.linkText}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.linkText}>Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  brandSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary || '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  signInSection: {
    marginBottom: 30,
  },
  signInTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary || '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  googleButtonContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  googleButton: {
    width: Math.min(width - 48, 280),
    height: 48,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285f4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    width: Math.min(width - 48, 280),
    height: 48,
  },
  loadingText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  emailButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  emailButtonText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  comingSoonText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  footer: {
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: Colors.primary,
    fontWeight: '500',
  },
});