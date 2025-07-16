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
  PermissionsAndroid,
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

// Create multiple rewarded ads for better loading
const createRewardedAd = () => RewardedAd.createForAdRequest(TestIds.REWARDED);
let rewardedAd = createRewardedAd();

// Coin packages for purchase
const COIN_PACKAGES = [
  { id: 1, coins: 500, price: 99, popular: false },
  { id: 2, coins: 1000, price: 150, popular: true },
  { id: 3, coins: 2500, price: 299, popular: false },
  { id: 4, coins: 5000, price: 499, popular: false },
];

export default function ProfileScreen() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [photos, setPhotos] = useState<string[]>([]);
  const [coins, setCoins] = useState<number>(0);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    let loadedListener;
    let earnedListener;

    const initializeAd = () => {
      setAdLoading(true);

      loadedListener = rewardedAd.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          setAdLoaded(true);
          setAdLoading(false);
        },
      );

      earnedListener = rewardedAd.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        async reward => {
          Alert.alert(
            '🎉 Congratulations!',
            `You earned ${reward.amount} coins!`,
          );
          if (user?.uid) {
            await firestore()
              .collection('users')
              .doc(user.uid)
              .update({
                coins: firestore.FieldValue.increment(reward.amount),
              });
          }
          loadNewAd();
        },
      );

      rewardedAd.load();
    };

    const loadNewAd = () => {
      rewardedAd = createRewardedAd();
      initializeAd();
    };

    initializeAd();

    return () => {
      if (loadedListener) loadedListener();
      if (earnedListener) earnedListener();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToUserCoins(user.uid, setCoins);
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(snapshot => {
        const data = snapshot.data();
        if (data?.photos) setPhotos(data.photos);
      });
    return unsubscribe;
  }, [user?.uid]);

  // Mpesa payment integration
  const initiateMpesaPayment = async packageInfo => {
    setProcessingPayment(true);

    try {
      // This is a placeholder for actual Mpesa integration
      // You'll need to integrate with your backend API that handles Mpesa payments
      const response = await fetch('YOUR_BACKEND_API/initiate-mpesa-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: packageInfo.price,
          phoneNumber: user.phoneNumber, // You'll need to collect this
          userId: user.uid,
          coins: packageInfo.coins,
        }),
      });

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          '📱 Payment Initiated',
          `Please check your phone for the Mpesa payment prompt. You'll receive ${packageInfo.coins} coins once payment is confirmed.`,
          [{ text: 'OK' }],
        );
      } else {
        throw new Error(result.message || 'Payment failed');
      }
    } catch (error) {
      Alert.alert(
        '❌ Payment Error',
        'Failed to initiate payment. Please try again.',
      );
      console.error('Payment error:', error);
    } finally {
      setProcessingPayment(false);
      setShowCoinModal(false);
    }
  };

  const uploadAndSavePhoto = async (uri: string) => {
    try {
      setUploading(true);
      const ref = storage().ref(`profile_pictures/${user?.uid}/${Date.now()}`);
      await ref.putFile(uri);
      const downloadURL = await ref.getDownloadURL();

      await firestore()
        .collection('users')
        .doc(user?.uid)
        .update({
          photos: firestore.FieldValue.arrayUnion(downloadURL),
        });

      Alert.alert('✅ Success!', 'Photo uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert(
        '❌ Upload Failed',
        'Could not upload the photo. Please try again.',
      );
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
          },
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          Alert.alert(
            'Permission Required',
            'Camera access is required to take photos. Please enable it in your device settings.',
            [{ text: 'OK' }],
          );
          return false;
        }
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    return true;
  };

  const handleCapturePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      cameraType: 'back',
      includeBase64: false,
      saveToPhotos: true,
    });

    if (result.didCancel || result.errorMessage) return;

    if (result.assets && result.assets[0]?.uri) {
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
              await firestore()
                .collection('users')
                .doc(user?.uid)
                .update({
                  photos: firestore.FieldValue.arrayRemove(photoURL),
                });
              Alert.alert('✅ Success!', 'Photo deleted successfully!');
            } catch (err) {
              console.error('Delete error:', err);
              Alert.alert(
                '❌ Delete Failed',
                'Could not delete the photo. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const handleWatchAd = () => {
    if (adLoaded) {
      rewardedAd.show();
    } else if (adLoading) {
      Alert.alert('⏳ Please wait', 'Ad is still loading...');
    } else {
      Alert.alert('😔 No ads available', 'Please try again in a moment.');
      // Try to reload the ad
      rewardedAd.load();
      setAdLoading(true);
    }
  };

  const handlePhotoPress = (photoURL: string) => {
    setSelectedPhoto(photoURL);
    setShowImageModal(true);
  };

  const handleLogout = () => {
    Alert.alert('🚪 Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await GoogleSignin.signOut();
            await auth().signOut();
            logout();
            Alert.alert(
              '👋 Goodbye!',
              'You have been logged out successfully.',
            );
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('❌ Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  const renderCoinPackage = ({ item }) => (
    <TouchableOpacity
      style={[styles.packageCard, item.popular && styles.popularPackage]}
      onPress={() => initiateMpesaPayment(item)}
      disabled={processingPayment}
    >
      {item.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>POPULAR</Text>
        </View>
      )}
      <Text style={styles.packageCoins}>{item.coins}</Text>
      <Text style={styles.packageCoinsLabel}>Coins</Text>
      <Text style={styles.packagePrice}>KES {item.price}</Text>
      <Text style={styles.packageValue}>
        {((item.coins / item.price) * 100).toFixed(0)} coins/KES
      </Text>
    </TouchableOpacity>
  );

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
        <View style={styles.headerTop}>
          <Text style={styles.header}>Profile</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <Image
            source={{ uri: user.photoURL || 'https://via.placeholder.com/80' }}
            style={styles.avatar}
          />
          <Text style={styles.name}>
            {user.displayName || user.name || 'User'}
          </Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>
      </View>

      {/* Coins Section */}
      <View style={styles.coinsSection}>
        <View style={styles.coinsCard}>
          <View style={styles.coinsHeader}>
            <Text style={styles.coinsIcon}>💰</Text>
            <View style={styles.coinsInfo}>
              <Text style={styles.coinsLabel}>Your Balance</Text>
              <Text style={styles.coinsValue}>{coins.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.coinsActions}>
            <TouchableOpacity
              style={[styles.coinActionButton, styles.buyCoinsButton]}
              onPress={() => setShowCoinModal(true)}
            >
              <Text style={styles.coinActionText}>💳 Buy Coins</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.coinActionButton,
                styles.adButton,
                (!adLoaded || adLoading) && styles.adButtonDisabled,
              ]}
              onPress={handleWatchAd}
              disabled={!adLoaded || adLoading}
            >
              <Text style={styles.coinActionText}>
                {adLoading
                  ? '⏳ Loading...'
                  : adLoaded
                  ? '📺 Watch Ad'
                  : '❌ Try Again'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Photos Section */}
      <View style={styles.photosSection}>
        <Text style={styles.sectionTitle}>Photo Gallery</Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              uploading && styles.actionButtonDisabled,
            ]}
            onPress={handleAddFromGallery}
            disabled={uploading}
          >
            <Text style={styles.actionButtonText}>📱 Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              uploading && styles.actionButtonDisabled,
            ]}
            onPress={handleCapturePhoto}
            disabled={uploading}
          >
            <Text style={styles.actionButtonText}>📷 Camera</Text>
          </TouchableOpacity>
        </View>

        {uploading && (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        )}

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
            <Text style={styles.emptyStateSubtext}>
              Add your first photo using the buttons above
            </Text>
          </View>
        )}
      </View>

      {/* Coin Purchase Modal */}
      <Modal
        visible={showCoinModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCoinModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.coinModalContent}>
            <View style={styles.coinModalHeader}>
              <Text style={styles.coinModalTitle}>Buy Coins</Text>
              <TouchableOpacity onPress={() => setShowCoinModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.coinModalSubtitle}>
              Choose a coin package to purchase with M-Pesa
            </Text>

            <FlatList
              data={COIN_PACKAGES}
              numColumns={2}
              keyExtractor={item => item.id.toString()}
              renderItem={renderCoinPackage}
              contentContainerStyle={styles.packagesGrid}
            />

            {processingPayment && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.processingText}>Processing payment...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

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
                <Image
                  source={{ uri: selectedPhoto }}
                  style={styles.modalImage}
                />
              )}
              <TouchableOpacity
                style={styles.imageCloseButton}
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
    backgroundColor: '#f8f9fa',
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  logoutButton: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6c757d',
  },
  coinsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  coinsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  coinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  coinsIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  coinsInfo: {
    flex: 1,
  },
  coinsLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  coinsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#28a745',
  },
  coinsActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coinActionButton: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyCoinsButton: {
    backgroundColor: '#007bff',
  },
  adButton: {
    backgroundColor: '#17a2b8',
  },
  adButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  coinActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  photosSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 0.48,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#ddd',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6c757d',
  },
  photoGrid: {
    paddingBottom: 16,
  },
  photoItem: {
    flex: 0.5,
    margin: 4,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  photo: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  deleteText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    borderRadius: 16,
  },
  imageCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  coinModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: screenWidth - 40,
    maxHeight: '80%',
  },
  coinModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  coinModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
  },
  closeButton: {
    fontSize: 20,
    color: '#6c757d',
    fontWeight: 'bold',
  },
  coinModalSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 20,
    textAlign: 'center',
  },
  packagesGrid: {
    paddingBottom: 16,
  },
  packageCard: {
    flex: 0.48,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    margin: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  popularPackage: {
    borderColor: '#ffc107',
    backgroundColor: '#fff8e1',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#ffc107',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#212529',
  },
  packageCoins: {
    fontSize: 24,
    fontWeight: '700',
    color: '#28a745',
    marginBottom: 4,
  },
  packageCoinsLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 8,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  packageValue: {
    fontSize: 10,
    color: '#6c757d',
  },
  processingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  processingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6c757d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
});
