import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        return;
    }

    // Get the token
    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

        if (!projectId) {
            console.warn("⚠️ Push Notification Warning: Project ID belum dikonfigurasi (EAS). Notifikasi tidak akan berjalan di Expo Go.");
            return null;
        }

        const pushTokenString = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        return pushTokenString;
    } catch (e) {
        // Suppress error in Expo Go if due to missing config
        console.warn("Skipping Push Token fetch (Dev Mode / No Config)");
        return null;
    }
}

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    const saveToken = async (token: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('users')
                .update({ push_token: token })
                .eq('id', user.id);

            if (error) console.error("Error saving push token:", error);
            else console.log("Push token saved for user:", user.email);

        } catch (e) {
            console.error("Error Saving Token:", e);
        }
    }

    useEffect(() => {
        let isMounted = true;

        const registerAndSave = async () => {
            const token = await registerForPushNotificationsAsync();
            if (isMounted) setExpoPushToken(token ?? undefined);

            if (token) {
                // Try saving immediately
                await saveToken(token);
            }
        };

        registerAndSave();

        // Listen for Auth Changes (Login) to re-save token
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user && expoPushToken) {
                console.log("User signed in, re-saving push token...");
                await saveToken(expoPushToken);
            }
        });

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log(response);
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [expoPushToken]); // Dependency on expoPushToken to save when it becomes available

    return {
        expoPushToken,
        notification,
    };
}
