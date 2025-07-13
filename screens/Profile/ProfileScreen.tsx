import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Alert, 
  FlatList, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions, 
  Platform,
  PermissionsAndroid
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import useAuthStore from '../../store/auth.store';
import { Colors } from '../themes/color';
import {
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { subscribeToUserCoins } from '../../services/CoinService';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../../services/FirebaseConfig';

const { width: screenWidth } = Dimensions.get('window');
const rewarded = RewardedAd.createForAdRequest(TestIds.REWARDED);

export default function ProfileScreen() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [photos, setPhotos] = useState<string[]>([]);
  const [coins, setCoins] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    const unsubscribeLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        setLoaded(true);
      }
    );

    const unsubscribeEarned = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      async (reward) => {
        Alert.alert('🎉 Congratulations!', `You earned ${reward.amount} coins!`);

        if (user?.uid) {
          await firestore().collection('users').doc(user.uid).update({
            coins: firestore.FieldValue.increment(reward.amount),
          });
        }
      }
    );

    rewarded.load();

    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToUserCoins(user.uid, setCoins);
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = firestore().collection('users').doc(user.uid)
      .onSnapshot(snapshot => {
        const data = snapshot.data();
        if (data?.photos) setPhotos(data.photos);
      });
    return unsubscribe;
  }, [user?.uid]);

  // Upload photo to Firebase Storage and save URL to Firestore
  const uploadAndSavePhoto = async (uri: string) => {
    try {
      setUploading(true);
      const ref = storage().ref(`profile_pictures/${user?.uid}/${Date.now()}`);
      await ref.putFile(uri);
      const downloadURL = await ref.getDownloadURL();

      await firestore().collection('users').doc(user?.uid).update({
        photos: firestore.FieldValue.arrayUnion(downloadURL),
      });
      
      Alert.alert('✅ Success!', 'Photo uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('❌ Upload Failed', 'Could not upload the photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddFromGallery = async () => {
    const result = await launchImageLibrary({ 
      mediaType: 'photo', 
      selectionLimit: 5,
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
    });
    
    if (result.assets) {
      for (const asset of result.assets) {
        if (asset.uri) await uploadAndSavePhoto(asset.uri);
      }
    }
  };
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera to take photos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Camera permission granted');
          return true;
        } else {
          console.log('Camera permission denied');
          Alert.alert(
            'Permission Required',
            'Camera access is required to take photos. Please enable it in your device settings.',
            [{ text: 'OK' }]
          );
          return false;
        }
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true; // iOS permissions are handled automatically by react-native-image-picker
  };
  const handleCapturePhoto = async () => {
    console.log('Launching camera...');
    
    // Request permission first
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return;
    }
    
    const result = await launchCamera({ 
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      cameraType: 'back',
      includeBase64: false,
      saveToPhotos: true,
    });
    
    // Handle user cancellation or errors
    if (result.didCancel) {
      console.log('User cancelled camera');
      return;
    }
    
    if (result.errorMessage) {
      console.log('Camera error:', result.errorMessage);
      Alert.alert('Camera Error', result.errorMessage);
      return;
    }
    
    if (result.assets && result.assets[0]?.uri) {
      console.log('Photo captured successfully:', result.assets[0].uri);
      await uploadAndSavePhoto(result.assets[0].uri);
    }
  };
  const handleDeletePhoto = async (photoURL: string) => {
    Alert.alert(
      '🗑️ Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const ref = storage().refFromURL(photoURL);
              await ref.delete();

              await firestore().collection('users').doc(user?.uid).update({
                photos: firestore.FieldValue.arrayRemove(photoURL),
              });
              
              Alert.alert('✅ Success!', 'Photo deleted successfully!');
            } catch (err) {
              console.error('Delete error:', err);
              Alert.alert('❌ Delete Failed', 'Could not delete the photo. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleWatchAd = () => {
    if (loaded) {
      rewarded.show();
    } else {
      Alert.alert('⏳ Please wait', 'Ad is still loading...');
      rewarded.load();
    }
  };

  const handlePhotoPress = (photoURL: string) => {
    setSelectedPhoto(photoURL);
    setShowImageModal(true);
  };
  const handleLogout = () => {
    Alert.alert(
      '🚪 Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            try {
              await GoogleSignin.signOut();  // disconnect from Google
      await auth().signOut();        // sign out from Firebase
              logout();
              Alert.alert('👋 Goodbye!', 'You have been logged out successfully.');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('❌ Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>User not logged in.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.header}>Your Profile</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>🚪 Logout</Text>
          </TouchableOpacity>
        <View style={styles.profileCard}>
          <Image 
            source={{ uri: user.photoURL || 'https://via.placeholder.com/100' }} 
            style={styles.avatar} 
          />
          <Text style={styles.name}>{user.displayName || user.name || 'User'}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
      </View>

      {/* Coins Section */}
      <View style={styles.coinsSection}>
        <View style={styles.coinsCard}>
          <Text style={styles.coinsIcon}>💰</Text>
          <View style={styles.coinsInfo}>
            <Text style={styles.coinsLabel}>Your Coins</Text>
            <Text style={styles.coinsValue}>{coins}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.adButton, !loaded && styles.adButtonDisabled]} 
          onPress={handleWatchAd}
          disabled={!loaded}
        >
          <Text style={styles.adButtonText}>
            {loaded ? '📺 Watch Ad to Earn Coins' : '⏳ Loading Ad...'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Photos Section */}
      <View style={styles.photosSection}>
        <Text style={styles.sectionTitle}>Photo Gallery</Text>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, uploading && styles.actionButtonDisabled]} 
            onPress={handleAddFromGallery}
            disabled={uploading}
          >
            <Text style={styles.actionButtonText}>📱 Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, uploading && styles.actionButtonDisabled]} 
            onPress={handleCapturePhoto}
            disabled={uploading}
          >
            <Text style={styles.actionButtonText}>📷 Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Upload Progress */}
        {uploading && (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.uploadingText}>Uploading photo...</Text>
          </View>
        )}

        {/* Photos Grid */}
        {photos.length > 0 ? (
          <FlatList
            data={photos}
            numColumns={2}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.photoGrid}
            renderItem={({ item }) => (
              <View style={styles.photoItem}>
                <TouchableOpacity onPress={() => handlePhotoPress(item)}>
                  <Image source={{ uri: item }} style={styles.photo} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => handleDeletePhoto(item)}
                >
                  <Text style={styles.deleteText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📸</Text>
            <Text style={styles.emptyStateText}>No photos yet</Text>
            <Text style={styles.emptyStateSubtext}>Add your first photo using the buttons above</Text>
          </View>
        )}
      </View>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackground}
            onPress={() => setShowImageModal(false)}
          >
            <View style={styles.modalContent}>
              {selectedPhoto && (
                <Image source={{ uri: selectedPhoto }} style={styles.modalImage} />
              )}
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowImageModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background || '#f5f5f5',
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary || '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 4,
    borderColor: Colors.primary || '#ddd',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary || '#333',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  coinsSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  coinsCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  coinsIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  coinsInfo: {
    flex: 1,
  },
  coinsLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  coinsValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.success || '#4CAF50',
  },
  adButton: {
    backgroundColor: '#FF4B7B',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  adButtonDisabled: {
    backgroundColor: '#ccc',
  },
  adButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  photosSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary || '#333',
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: Colors.primary || '#007AFF',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flex: 0.48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 15,
  },
  uploadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
  photoGrid: {
    paddingBottom: 20,
  },
  photoItem: {
    flex: 0.5,
    margin: 5,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  photo: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  deleteText: {
    fontSize: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    position: 'relative',
    margin: 20,
  },
  modalImage: {
    width: screenWidth - 40,
    height: screenWidth - 40,
    borderRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background || '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    textAlign: 'center',
  },
});