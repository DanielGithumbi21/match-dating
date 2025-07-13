import firestore from '@react-native-firebase/firestore';

// Define chat type
export interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  updatedAt: Date;
  unreadCounts: Record<string, number>;
}


/**
 * Subscribe to chats collection in Firestore.
 * Calls the callback every time data changes.
 */
export function subscribeToChats(currentUserId: string, onChatsUpdate: (chats: Chat[]) => void) {
  return firestore()
    .collection('chats')
    .where('participants', 'array-contains', currentUserId)
    .orderBy('updatedAt', 'desc')
    .onSnapshot(
      snapshot => {
        const chats: Chat[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...(data as Omit<Chat, 'id' | 'updatedAt' | 'unreadCount'>),
            updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
            unreadCount: data.unreadCount || 0, 
          };
        });
        onChatsUpdate(chats);
      },
      error => {
        console.error('Error fetching chats:', error);
      }
    );
}



export function subscribeToMessages(chatId: string, onMessagesUpdate: (messages: Message[]) => void) {
  return firestore()
    .collection('chats')
    .doc(chatId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      const messages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...(data as Omit<Message, 'id'>),
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        };
      });
      onMessagesUpdate(messages);
    }, error => {
      console.error('Error fetching messages:', error);
    });
  }
// src/services/ChatService.ts

export async function sendMessage(chatId: string, messageText: string, senderId: string) {
  const chatRef = firestore().collection('chats').doc(chatId);

  // Add the message
  await chatRef.collection('messages').add({
    text: messageText,
    senderId,
    createdAt: firestore.FieldValue.serverTimestamp(),
    readBy: [senderId],
  });

  // Get existing chat data
  const chatDoc = await chatRef.get();
  const chatData = chatDoc.data();
  const participants: string[] = chatData?.participants || [];
  const existingUnreadCounts: Record<string, number> = chatData?.unreadCounts || {};

  // Update unread counts
  const newUnreadCounts: Record<string, number> = {};
  participants.forEach(uid => {
    newUnreadCounts[uid] = uid === senderId ? 0 : (existingUnreadCounts[uid] || 0) + 1;
  });

  // Update the chat doc
  await chatRef.update({
    lastMessage: messageText,
    updatedAt: firestore.FieldValue.serverTimestamp(),
    unreadCounts: newUnreadCounts,
  });
}
export async function markChatAsRead(chatId: string, userId: string) {
  const chatRef = firestore().collection('chats').doc(chatId);
  await chatRef.update({
    [`unreadCounts.${userId}`]: 0,
  });
}
  
export async function createChat(currentUserId: string, otherUserId: string): Promise<string> {
  try {
    const chatsSnapshot = await firestore()
      .collection('chats')
      .where('participants', 'array-contains', currentUserId)
      .get();

    const existingChat = chatsSnapshot.docs.find(doc => {
      const participants = doc.data().participants as string[];
      return participants.includes(otherUserId);
    });

    if (existingChat) {
      return existingChat.id;
    }

    // Create a new chat if not found
    const chatRef = await firestore().collection('chats').add({
      participants: [currentUserId, otherUserId],
      lastMessage: '',
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return chatRef.id;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Date;
}