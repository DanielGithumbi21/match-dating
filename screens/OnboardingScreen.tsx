import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Geolocation from '@react-native-community/geolocation';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import useAuthStore from '../store/auth.store';
import { Colors } from './themes/color';

export default function OnboardingScreen() {
  const route = useRoute();
  const { setUser } = useAuthStore();

  // Get tempUser from navigation params (passed from LoginScreen)
  const tempUser = route.params?.tempUser;

  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [interestedIn, setInterestedIn] = useState<'male' | 'female' | null>(
    null,
  );
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const calculateAge = (birthDate: Date) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };
  useEffect(() => {
    const askLocationPermission = async () => {
      const permission =
        Platform.OS === 'ios'
          ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
          : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        console.log('Permission granted ✅');
      } else if (result === RESULTS.DENIED) {
        console.log('Permission denied ❌ (but can ask again)');
      } else if (result === RESULTS.BLOCKED) {
        console.log('Permission blocked ❌ (open settings manually)');
      }
    };

    askLocationPermission();
  }, []);
  const handleLocationPermission = async () => {
    const permission =
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;

    const result = await request(permission);
    return result === RESULTS.GRANTED;
  };

  const fetchLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => resolve(position.coords),
        error => reject(error),
        {
          enableHighAccuracy: false, // try false to use network-based location first
          timeout: 20000, // increase timeout (20s)
          maximumAge: 10000, // use cached location up to 10s old
        },
      );
    });
  };

  const handleSubmit = async () => {
    if (!gender || !interestedIn || !dob) {
      return Alert.alert('Error', 'Please fill all fields');
    }

    if (!tempUser) {
      return Alert.alert(
        'Error',
        'User data not found. Please try logging in again.',
      );
    }

    const age = calculateAge(dob);

    if (age < 18) {
      return Alert.alert(
        'Age Restriction',
        'You must be at least 18 years old to use this app.',
      );
    }

    setIsLoading(true);

    try {
      // Request location permission
      const granted = await handleLocationPermission();
      if (!granted) {
        Alert.alert(
          'Location Required',
          'Location permission is required to find matches near you.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
        setIsLoading(false);
        return;
      }
      console.log('Location permission granted');
      // Get current location
      const { latitude, longitude } = await fetchLocation();

      console.log('Current location:', { latitude, longitude });
      // Prepare onboarding data
      const onboardingData = {
        gender,
        interestedIn,
        dob: dob.toISOString(),
        age,
        location: { latitude, longitude },
        onboardingCompleted: true,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      console.log(onboardingData);
      // Update user document in Firestore
      await firestore()
        .collection('users')
        .doc(tempUser.uid)
        .update(onboardingData);

      // Now set the complete user data in the store
      // This will trigger the AppNavigator to switch to MainTabs
      setUser({
        ...tempUser,
        ...onboardingData,
      });

      console.log('Onboarding completed successfully');
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert(
        'Error',
        'Something went wrong while completing your profile. Please try again.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state if no tempUser (shouldn't happen in normal flow)
  if (!tempUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tell us about yourself</Text>
        <Text style={styles.subtitle}>
          Help us find the perfect matches for you
        </Text>
      </View>

      <View style={styles.content}>
        {/* Gender Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>I am</Text>
          <View style={styles.row}>
            {['male', 'female'].map(option => (
              <TouchableOpacity
                key={option}
                style={[styles.option, gender === option && styles.selected]}
                onPress={() => setGender(option as 'male' | 'female')}
                activeOpacity={0.7}
              >
                <Icon
                  name={option === 'male' ? 'gender-male' : 'gender-female'}
                  size={24}
                  color={gender === option ? Colors.primary : '#666'}
                />
                <Text
                  style={[
                    styles.optionText,
                    gender === option && styles.selectedText,
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interested In Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Interested in</Text>
          <View style={styles.row}>
            {['male', 'female'].map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.option,
                  interestedIn === option && styles.selected,
                ]}
                onPress={() => setInterestedIn(option as 'male' | 'female')}
                activeOpacity={0.7}
              >
                <Icon
                  name={option === 'male' ? 'gender-male' : 'gender-female'}
                  size={24}
                  color={interestedIn === option ? Colors.primary : '#666'}
                />
                <Text
                  style={[
                    styles.optionText,
                    interestedIn === option && styles.selectedText,
                  ]}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date of Birth Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            onPress={() => setShowPicker(true)}
            style={styles.dobButton}
            activeOpacity={0.7}
          >
            <Icon name="calendar" size={20} color={Colors.primary} />
            <Text style={styles.dobText}>
              {dob ? dob.toDateString() : 'Select your birthday'}
            </Text>
            <Icon name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
          {dob && (
            <Text style={styles.ageText}>
              Age: {calculateAge(dob)} years old
            </Text>
          )}
        </View>

        {showPicker && (
          <DateTimePicker
            mode="date"
            display="spinner"
            value={dob || new Date(2000, 0, 1)}
            onChange={(_, selectedDate) => {
              setShowPicker(false);
              if (selectedDate) setDob(selectedDate);
            }}
            maximumDate={new Date()}
            minimumDate={new Date(1950, 0, 1)}
          />
        )}
      </View>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!gender || !interestedIn || !dob || isLoading) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!gender || !interestedIn || !dob || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Complete Profile</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          By completing your profile, you agree to our matching algorithm using
          your location and preferences.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background || '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 8,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 18,
    marginBottom: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    backgroundColor: '#fff',
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  selectedText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  dobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dobText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  ageText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
