/* Folder: src/screens/Auth/OnboardingScreen.tsx */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Button, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Geolocation from '@react-native-community/geolocation';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/auth.store';
import { Colors } from './themes/color';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

export default function OnboardingScreen() {
  const { user, logout, setUser } = useAuthStore();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();


  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [interestedIn, setInterestedIn] = useState<'male' | 'female' | null>(null);
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const calculateAge = (birthDate: Date) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleLocationPermission = async () => {
    const permission = Platform.OS === 'android'
      ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
      : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;

    const result = await request(permission);
    return result === RESULTS.GRANTED;
  };

  const fetchLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => resolve(position.coords),
        error => reject(error),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  };

  const handleSubmit = async () => {
    if (!gender || !interestedIn || !dob) return Alert.alert('Error', 'Please fill all fields');

    const age = calculateAge(dob);

    try {
      const granted = await handleLocationPermission();
      if (!granted) {
        Alert.alert('Location Required', 'Location permission is required.');
        logout();
        return;
      }

      const { latitude, longitude } = await fetchLocation();

      await firestore().collection('users').doc(user?.uid).set(
        {
          gender,
          interestedIn,
          dob: dob.toISOString(),
          age,
          location: { latitude, longitude },
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      setUser({ ...user, gender, interestedIn, age, location: { latitude, longitude } });
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });

    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tell us about yourself</Text>

      <Text style={styles.label}>Gender</Text>
      <View style={styles.row}>
        {['male', 'female'].map(option => (
          <TouchableOpacity key={option} style={[styles.option, gender === option && styles.selected]} onPress={() => setGender(option as 'male' | 'female')}>
            <Icon name={option === 'male' ? 'gender-male' : 'gender-female'} size={24} color={Colors.primary} />
            <Text>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Interested In</Text>
      <View style={styles.row}>
        {['male', 'female'].map(option => (
          <TouchableOpacity key={option} style={[styles.option, interestedIn === option && styles.selected]} onPress={() => setInterestedIn(option as 'male' | 'female')}>
            <Icon name={option === 'male' ? 'gender-male' : 'gender-female'} size={24} color={Colors.primary} />
            <Text>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Date of Birth</Text>
      <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.dobButton}>
        <Text>{dob ? dob.toDateString() : 'Select Date'}</Text>
      </TouchableOpacity>

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
        />
      )}

      <Button title="Finish" onPress={handleSubmit} color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 16, justifyContent: 'center' },
  title: { fontSize: 24, textAlign: 'center', marginBottom: 20, color: Colors.primary, fontWeight: 'bold' },
  label: { fontSize: 16, marginTop: 16, marginBottom: 8, color: Colors.primary },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  option: { alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#eee', width: 100 },
  selected: { backgroundColor: '#ffddee' },
  dobButton: { padding: 12, borderRadius: 8, backgroundColor: '#eee', alignItems: 'center', marginBottom: 20 },
});
