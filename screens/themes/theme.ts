// Folder: src/theme/theme.ts

import { MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { Colors } from './color';

export const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    secondary: Colors.secondary,
    background: Colors.background,
    surface: Colors.surface,
    error: Colors.error,
    onPrimary: '#FFFFFF',
    onSecondary: Colors.textPrimary,
    onBackground: Colors.textPrimary,
    onSurface: Colors.textPrimary,
    onError: '#FFFFFF',
  },
  roundness: 8,
};
