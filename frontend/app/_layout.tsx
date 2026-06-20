import '../global.css';
import { Stack } from 'expo-router';
import { AppProvider } from '../context/AppContext';
import { LanguageProvider } from '../context/LanguageContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AppProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProvider>
    </LanguageProvider>
  );
}
