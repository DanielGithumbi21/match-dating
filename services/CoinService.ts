import firestore from '@react-native-firebase/firestore';

export function subscribeToUserCoins(userId: string, onUpdate: (coins: number) => void) {
    return firestore()
      .collection('users')
      .doc(userId)
      .onSnapshot(
        (doc) => {
          const data = doc.data();
          onUpdate(data?.coins ?? 0);
        },
        (error) => {
          console.error('Error subscribing to coins:', error);
        }
      );
  }

export async function updateUserCoins(userId: string, amount: number) {
  const userRef = firestore().collection('users').doc(userId);

  return firestore().runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) throw new Error('User not found');

    const currentCoins = userDoc.data()?.coins || 0;
    if (currentCoins + amount < 0) throw new Error('Insufficient coins');

    transaction.update(userRef, { coins: currentCoins + amount });
  });
}
