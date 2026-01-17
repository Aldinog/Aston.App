import { Slot, Stack } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import "../global.css";
import { LogBox } from "react-native";
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { usePushNotifications } from '../hooks/usePushNotifications'; // Import Hook

// Ignore specific logs including Reanimated's strict mode warning
LogBox.ignoreLogs([
    "[Reanimated] Reading from `value` during component render",
]);

// Configure Reanimated Logger to be less strict
configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false, // Disable strict mode as requested
});

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        // Bisa tambah font custom disini nanti
    });

    // Initialize Push Notifications
    usePushNotifications();

    if (!fontsLoaded) {
        // return <Slot />; // Or custom splash
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="light" backgroundColor="#0f172a" />
            <Stack screenOptions={{
                headerShown: false,
            }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
        </GestureHandlerRootView>
    );
}
