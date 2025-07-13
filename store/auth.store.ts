import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: any;
  setUser: (user: any) => void;
  logout: () => void;
  loadUserFromStorage: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => {
    AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
  logout: () => {
    AsyncStorage.removeItem('user');
    set({ user: null });
  },
  loadUserFromStorage: async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      set({ user: JSON.parse(userData) });
    }
  },
}));

export default useAuthStore;
