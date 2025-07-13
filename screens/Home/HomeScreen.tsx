import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  FlatList, 
  Image, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import useAuthStore from '../../store/auth.store';
import { createChat } from '../../services/ChatService';
import { Colors } from '../themes/color';
import LinearGradient from 'react-native-linear-gradient';

interface User {
  id: string;
  name: string;
  photoURL: string;
  isOnline: boolean;
  lastSeen?: Date;
  bio?: string;
  interests?: string[];
  age?: number;
  location?: string;
}


export default function HomeScreen({ navigation }: any) {
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'online' | 'nearby'>('all');

  // Memoized filtered users
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.interests?.some(interest => 
          interest.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Apply status filter
    switch (selectedFilter) {
      case 'online':
        filtered = filtered.filter(user => user.isOnline);
        break;
      case 'nearby':
        // Placeholder for location-based filtering
        // filtered = filtered.filter(user => user.location === currentUser?.location);
        break;
      default:
        break;
    }

    return filtered;
  }, [users, searchQuery, selectedFilter]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot(
        snapshot => {
          const usersData = snapshot.docs
            .map(doc => ({ 
              id: doc.id, 
              ...(doc.data() as Omit<User, 'id'>),
              lastSeen: doc.data().lastSeen?.toDate() || new Date()
            }))
            .filter(user => user.id !== currentUser?.uid);
          
          setUsers(usersData);
          setLoading(false);
        },
        error => {
          console.error('Error fetching users:', error);
          setLoading(false);
          Alert.alert('Error', 'Failed to load users. Please try again.');
        }
      );

    return unsubscribe;
  }, [currentUser]);

  const handleChat = useCallback(async (otherUser: User) => {
    try {
      const chatId = await createChat(currentUser?.uid, otherUser.id);
      navigation.navigate('ChatDetail', { 
        chatId, 
        chatName: otherUser.name,
        otherUser: otherUser
      });
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  }, [currentUser?.uid, navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Refresh will be handled by the Firestore listener
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getLastSeenText = useCallback((user: User) => {
    if (user.isOnline) return 'Online';
    if (!user.lastSeen) return 'Last seen recently';
    
    const now = new Date();
    const lastSeen = new Date(user.lastSeen);
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  }, []);

  const renderUserTile = useCallback(({ item }: { item: User }) => (
    <TouchableOpacity 
      style={styles.tile} 
      onPress={() => handleChat(item)}
      activeOpacity={0.8}
    >
      <View style={styles.avatarContainer}>
        <Image 
          source={{ uri: item.photoURL || 'https://via.placeholder.com/150' }} 
          style={styles.avatar}
        />
        <View style={[
          styles.statusDot, 
          { backgroundColor: item.isOnline ? '#4CAF50' : '#9E9E9E' }
        ]} />
      </View>
      
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
      
      {item.age && (
        <Text style={styles.age}>{item.age} years old</Text>
      )}
      
      <Text style={styles.lastSeen}>{getLastSeenText(item)}</Text>
      
      {item.bio && (
        <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
      )}
      
      {item.interests && item.interests.length > 0 && (
        <View style={styles.interestsContainer}>
          {item.interests.slice(0, 2).map((interest, index) => (
            <View key={index} style={styles.interestTag}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
          {item.interests.length > 2 && (
            <Text style={styles.moreInterests}>+{item.interests.length - 2}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  ), [handleChat, getLastSeenText]);

  const renderFilterButton = useCallback((
    filter: 'all' | 'online' | 'nearby', 
    title: string, 
    count?: number
  ) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter && styles.filterButtonTextActive
      ]}>
        {title} {count !== undefined && `(${count})`}
      </Text>
    </TouchableOpacity>
  ), [selectedFilter]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Discover People</Text>
      <Text style={styles.headerSubtitle}>
        {filteredUsers.length} {filteredUsers.length === 1 ? 'person' : 'people'} nearby
      </Text>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, bio, or interests..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', users.length)}
        {renderFilterButton('online', 'Online', users.filter(u => u.isOnline).length)}
        {renderFilterButton('nearby', 'Nearby')}
      </View>
    </View>
  ), [filteredUsers.length, searchQuery, renderFilterButton, users]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>
        {searchQuery ? 'No results found' : 'No people found'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery 
          ? 'Try adjusting your search or filters'
          : 'Check back later for new people to connect with'
        }
      </Text>
    </View>
  ), [searchQuery]);

  if (loading) {
    return (
      <LinearGradient colors={['#FFFFFF', '#FFF5E1']} style={styles.container}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Finding people for you...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFFFFF', '#FFF5E1']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={filteredUsers}
          renderItem={renderUserTile}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          getItemLayout={(data, index) => ({
            length: 280,
            offset: 280 * Math.floor(index / 2),
            index,
          })}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary || '#666',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary || '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary || '#666',
    marginBottom: 20,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary || '#007AFF',
    borderColor: Colors.primary || '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: Colors.textSecondary || '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  tile: {
    flex: 1,
    margin: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    minHeight: 180,
  },
  avatarContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 18,
    color: Colors.textPrimary || '#333',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  age: {
    fontSize: 14,
    color: Colors.textSecondary || '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  lastSeen: {
    fontSize: 12,
    color: Colors.textSecondary || '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: Colors.textSecondary || '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  interestTag: {
    backgroundColor: Colors.primary ? `${Colors.primary}20` : '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  interestText: {
    fontSize: 12,
    color: Colors.primary || '#007AFF',
    fontWeight: '500',
  },
  moreInterests: {
    fontSize: 12,
    color: Colors.textSecondary || '#666',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary || '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary || '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});