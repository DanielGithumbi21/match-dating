/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  Image, 
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions
} from 'react-native';
import useAuthStore from '../../store/auth.store';
import { markChatAsRead, Message, sendMessage, subscribeToMessages } from '../../services/ChatService';
import { Colors } from '../themes/color';
import dayjs from 'dayjs';
import { User } from './ChatListScreen';
import firestore from '@react-native-firebase/firestore';
import { updateUserCoins } from '../../services/CoinService';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

export default function ChatDetailScreen({ route }: any) {
  const { chatId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const user = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const markAsRead = async () => {
      await markChatAsRead(chatId, user?.uid);
    };
  
    markAsRead();
    setIsLoading(true);
  
    const unsubscribe = subscribeToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
      setIsLoading(false);
    });
    
    return unsubscribe;
  }, [chatId, user?.uid]);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .onSnapshot(snapshot => {
        const userMap: Record<string, User> = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          userMap[doc.id] = { id: doc.id, name: data.name, photoURL: data.photoURL };
        });
        setUsers(userMap);
      });
  
    return unsubscribe;
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
  
    setIsSending(true);
    const messageText = input.trim();
    setInput(''); // Clear input immediately for better UX
  
    try {
      await updateUserCoins(user?.uid, -10); 
      await sendMessage(chatId, messageText, user?.uid);
    } catch (error: any) {
      Alert.alert('Error', error.message);
      setInput(messageText); // Restore input on error
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    setShowScrollToBottom(!isAtBottom);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === user?.uid;
    const sender = users[item.senderId];
    const isFirstInGroup = index === 0 || messages[index - 1].senderId !== item.senderId;
    const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId !== item.senderId;
    
    return (
      <Animated.View 
        style={[
          styles.messageRow, 
          isMine ? styles.myRow : styles.theirRow,
          { opacity: fadeAnim }
        ]}
      >
        {!isMine && (
          <View style={styles.avatarContainer}>
            {isLastInGroup && sender?.photoURL ? (
              <Image source={{ uri: sender.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble, 
          isMine ? styles.myMessage : styles.theirMessage,
          {
            marginTop: isFirstInGroup ? 8 : 2,
            marginBottom: isLastInGroup ? 8 : 2,
          }
        ]}>
          {!isMine && isFirstInGroup && sender?.name && (
            <Text style={styles.senderName}>{sender.name}</Text>
          )}
          
          <Text style={[
            styles.messageText, 
            isMine ? styles.myMessageText : styles.theirMessageText
          ]}>
            {item.text}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[styles.timeText, isMine ? styles.myTimeText : styles.theirTimeText]}>
              {item.createdAt ? dayjs(item.createdAt).format('HH:mm') : ''}
            </Text>
            {isMine && (
              <Icon 
                name="done" 
                size={12} 
                color="rgba(255,255,255,0.7)" 
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
        
        {isMine && (
          <View style={styles.avatarContainer}>
            {isLastInGroup && user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [messages]);

  const renderLoadingIndicator = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.loadingText}>Loading messages...</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="chat-bubble-outline" size={64} color={Colors.secondary} />
      <Text style={styles.emptyText}>No messages yet</Text>
      <Text style={styles.emptySubText}>Start the conversation!</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isLoading ? renderLoadingIndicator() : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.flatListContent,
            messages.length === 0 ? styles.emptyListContent : {}
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {showScrollToBottom && (
        <TouchableOpacity style={styles.scrollToBottomButton} onPress={scrollToBottom}>
          <Icon name="keyboard-arrow-down" size={24} color={Colors.primary} />
        </TouchableOpacity>
      )}

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            style={styles.input}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              (!input.trim() || isSending) && styles.sendButtonDisabled
            ]} 
            onPress={handleSend}
            disabled={!input.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.inputFooter}>
          <Text style={styles.coinText}>10 coins per message</Text>
          <Text style={styles.characterCount}>{input.length}/1000</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  
  emptySubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  
  flatListContent: { 
    padding: 16,
    paddingBottom: 20,
  },
  
  emptyListContent: {
    flexGrow: 1,
  },
  
  messageRow: { 
    flexDirection: 'row', 
    marginVertical: 1,
    alignItems: 'flex-end',
  },
  
  myRow: { 
    justifyContent: 'flex-end',
  },
  
  theirRow: { 
    justifyContent: 'flex-start',
  },
  
  avatarContainer: {
    width: 40,
    alignItems: 'center',
  },
  
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
  },
  
  avatarPlaceholder: {
    width: 28,
    height: 28,
  },
  
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    maxWidth: width * 0.75,
    minWidth: 60,
  },
  
  myMessage: { 
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    marginRight: 8,
  },
  
  theirMessage: { 
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  
  messageText: { 
    fontSize: 16,
    lineHeight: 20,
  },
  
  myMessageText: { 
    color: '#ffffff' 
  },
  
  theirMessageText: { 
    color: '#333' 
  },
  
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  
  timeText: { 
    fontSize: 10,
    marginTop: 2,
  },
  
  myTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  
  theirTimeText: {
    color: '#999',
  },
  
  readIcon: {
    marginLeft: 4,
  },
  
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: '#ffffff',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  
  inputContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
    color: '#333',
  },
  
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  
  coinText: {
    fontSize: 12,
    color: '#666',
  },
  
  characterCount: {
    fontSize: 12,
    color: '#999',
  },
});