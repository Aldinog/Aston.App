import { Slot, Stack } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import "../global.css";
import { LogBox } from "react-native";
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { usePushNotifications } from '../hooks/usePushNotifications'; // Import Hook
import UpdateChecker from "../components/UpdateChecker";

// Ignore specific logs including Reanimated's strict mode warning
LogBox.ignoreLogs([
    "[Reanimated] Reading from `value` during component render",
]);

// Configure Reanimated Logger to be less strict
configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false, // Disable strict mode as requested
});

import { ErrorBoundary } from "../components/ErrorBoundary";
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        // Bisa tambah font custom disini nanti
    });

    console.log("RootLayout: Fonts loaded state:", fontsLoaded);

    // Initialize Push Notifications
    usePushNotifications();

    useEffect(() => {
        if (fontsLoaded) {
            console.log("RootLayout: Hiding Splash Screen (Fonts Loaded)");
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    // Safety Timeout: Force hide after 5 seconds if fonts fail to load
    useEffect(() => {
        const timer = setTimeout(async () => {
            console.warn("RootLayout: Force hiding Splash Screen (Timeout 5s)");
            await SplashScreen.hideAsync();
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    if (!fontsLoaded) {
        // Return null to keep splash screen up, but our timeout handles the stuck case
        return null;
    }

    return (
        <SafeAreaProvider>
            <ErrorBoundary>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <StatusBar style="light" backgroundColor="#0f172a" />
                    <UpdateChecker />
                    <Stack screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: '#0f172a' }
                    }}>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    </Stack>
                </GestureHandlerRootView>
            </ErrorBoundary>
        </SafeAreaProvider>
    );
}
