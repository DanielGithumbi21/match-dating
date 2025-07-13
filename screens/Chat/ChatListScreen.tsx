import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  SafeAreaView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import firestore from '@react-native-firebase/firestore';
import { Colors } from '../themes/color';
import { Chat, subscribeToChats } from '../../services/ChatService';
import useAuthStore from '../../store/auth.store';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import LinearGradient from 'react-native-linear-gradient';

dayjs.extend(relativeTime);


type RootStackParamList = {
  ChatList: undefined;
  ChatDetail: { chatId: string; chatName: string; otherUser?: User };
};

export interface User {
  id: string;
  name: string;
  photoURL: string;
  isOnline?: boolean;
  lastSeen?: Date;
  bio?: string;
}

interface EnhancedChat extends Chat {
  otherUser?: User;
  isTyping?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
}

export default function ChatListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'ChatList'>>();
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'online'>('all');
  const user = useAuthStore((state) => state.user);

  // Memoized enhanced chats with user data
  const enhancedChats = useMemo(() => {
    return chats.map(chat => {
      const otherUserId = chat.participants.find(id => id !== user?.uid);
      const otherUser = users[otherUserId ?? ''];
      return {
        ...chat,
        otherUser,
      } as EnhancedChat;
    });
  }, [chats, users, user?.uid]);

  // Filtered and sorted chats
  const filteredChats = useMemo(() => {
    let filtered = enhancedChats;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(chat =>
        chat.otherUser?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    switch (filter) {
      case 'unread':
        filtered = filtered.filter(chat => 
          (chat.unreadCounts?.[user?.uid || ''] || 0) > 0
        );
        break;
      case 'online':
        filtered = filtered.filter(chat => chat.otherUser?.isOnline);
        break;
      default:
        break;
    }

    // Sort by: pinned first, then by last message time
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [enhancedChats, searchQuery, filter, user?.uid]);

  // Unread count for badge
  const totalUnreadCount = useMemo(() => {
    return chats.reduce((total, chat) => {
      return total + (chat.unreadCounts?.[user?.uid || ''] || 0);
    }, 0);
  }, [chats, user?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeToChats(user?.uid, (chatsData) => {
      setChats(chatsData);
      setLoading(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot(
        snapshot => {
          const userMap: Record<string, User> = {};
          snapshot.forEach(doc => {
            const data = doc.data();
            userMap[doc.id] = {
              id: doc.id,
              name: data.name,
              photoURL: data.photoURL,
              isOnline: data.isOnline ?? false,
              lastSeen: data.lastSeen?.toDate(),
              bio: data.bio,
            };
          });
          setUsers(userMap);
        },
        error => {
          console.error('Error fetching users:', error);
          Alert.alert('Error', 'Failed to load user data');
        }
      );

    return unsubscribe;
  }, []);

  const openChat = useCallback((chat: EnhancedChat) => {
    const chatName = chat.otherUser?.name || 'Unknown';
    navigation.navigate('ChatDetail', { 
      chatId: chat.id, 
      chatName,
      otherUser: chat.otherUser
    });
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getLastSeenText = useCallback((userNew: User) => {
    if (userNew.isOnline) return 'Online';
    if (!userNew.lastSeen) return 'Last seen recently';
    
    const now = new Date();
    const lastSeen = new Date(userNew.lastSeen);
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }, []);

  const renderFilterButton = useCallback((
    filterType: 'all' | 'unread' | 'online',
    title: string,
    count?: number
  ) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && styles.filterButtonActive
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.filterButtonTextActive
      ]}>
        {title}
        {count !== undefined && count > 0 && ` (${count})`}
      </Text>
    </TouchableOpacity>
  ), [filter]);

  const renderChatItem = useCallback(({ item }: { item: EnhancedChat }) => {
    const unread = item.unreadCounts?.[user?.uid || ''] || 0;
    const hasUnread = unread > 0;

    return (
      <TouchableOpacity 
        style={[
          styles.chatItem,
          hasUnread && styles.chatItemUnread
        ]} 
        onPress={() => openChat(item)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: item.otherUser?.photoURL || 'https://via.placeholder.com/48' }} 
            style={styles.avatar}
          />
          {item.otherUser?.isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.textContainer}>
          <View style={styles.row}>
            <Text style={[
              styles.chatName,
              hasUnread && styles.chatNameUnread
            ]}>
              {item.otherUser?.name ?? 'Unknown'}
            </Text>

            <View style={styles.rightSection}>
              {item.isPinned && (
                <Text style={styles.pinIcon}>📌</Text>
              )}
              {item.isMuted && (
                <Text style={styles.muteIcon}>🔇</Text>
              )}
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.bottomRow}>
            <Text style={[
              styles.lastMessage,
              hasUnread && styles.lastMessageUnread
            ]} numberOfLines={1}>
              {item.isTyping ? 'Typing...' : (item.lastMessage || 'Say hello 👋')}
            </Text>
            
            <Text style={styles.time}>
              {item.updatedAt ? dayjs(item.updatedAt).fromNow() : ''}
            </Text>
          </View>

          {item.otherUser && !item.otherUser.isOnline && (
            <Text style={styles.lastSeen}>
              {getLastSeenText(item.otherUser)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [user?.uid, openChat, getLastSeenText]);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Messages</Text>
      {totalUnreadCount > 0 && (
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{totalUnreadCount}</Text>
        </View>
      )}
    </View>
  ), [totalUnreadCount]);

  const renderSearchAndFilters = useCallback(() => (
    <View style={styles.searchAndFilters}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>
      
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All')}
        {renderFilterButton('unread', 'Unread', 
          chats.filter(chat => (chat.unreadCounts?.[user?.uid || ''] || 0) > 0).length
        )}
        {renderFilterButton('online', 'Online',
          enhancedChats.filter(chat => chat.otherUser?.isOnline).length
        )}
      </View>
    </View>
  ), [searchQuery, renderFilterButton, chats, user?.uid, enhancedChats]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>
        {searchQuery ? 'No conversations found' : 'No conversations yet'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {searchQuery 
          ? 'Try adjusting your search or filters'
          : 'Start a conversation from the Discover tab'
        }
      </Text>
    </View>
  ), [searchQuery]);

  if (loading) {
    return (
      <LinearGradient colors={['#FFFFFF', '#FFF5E1']} style={styles.container}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#FFFFFF', '#FFF5E1']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          ListHeaderComponent={
            <>
              {renderHeader()}
              {renderSearchAndFilters()}
            </>
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary || '#333',
  },
  headerBadge: {
    backgroundColor: Colors.primary || '#007AFF',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchAndFilters: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchContainer: {
    marginBottom: 12,
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
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chatItemUnread: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary || '#007AFF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F0F0',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: '#fff',
  },
  textContainer: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary || '#333',
    flex: 1,
  },
  chatNameUnread: {
    fontWeight: '700',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinIcon: {
    fontSize: 12,
  },
  muteIcon: {
    fontSize: 12,
  },
  unreadBadge: {
    backgroundColor: Colors.primary || '#007AFF',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 15,
    color: Colors.textSecondary || '#666',
    flex: 1,
    marginRight: 8,
  },
  lastMessageUnread: {
    fontWeight: '500',
    color: Colors.textPrimary || '#333',
  },
  time: {
    fontSize: 12,
    color: Colors.textSecondary || '#999',
  },
  lastSeen: {
    fontSize: 12,
    color: Colors.textSecondary || '#999',
    marginTop: 2,
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