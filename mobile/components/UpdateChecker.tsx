import React, { useEffect } from 'react';
import { Alert, StyleSheet, View, Text } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Checks for updates on app startup.
 * If an update is available, prompts the user to restart the app.
 */
export default function UpdateChecker() {
    useEffect(() => {
        async function checkUpdates() {
            try {
                if (__DEV__) return; // Don't check in dev mode

                const update = await Updates.checkForUpdateAsync();

                if (update.isAvailable) {
                    Alert.alert(
                        "Update Tersedia! 🚀",
                        "Versi baru aplikasi sudah siap. Download sekarang?",
                        [
                            { text: "Nanti Saja", style: "cancel" },
                            {
                                text: "Update Sekarang",
                                onPress: async () => {
                                    /*
                                      Do not show alert here, just download.
                                      Wait for download...
                                    */
                                    await fetchUpdate();
                                }
                            }
                        ]
                    );
                }
            } catch (e) {
                // Ignore errors (e.g. no internet)
                console.log("Update check failed:", e);
            }
        }

        checkUpdates();
    }, []);

    const fetchUpdate = async () => {
        try {
            await Updates.fetchUpdateAsync();
            Alert.alert(
                "Update Selesai ✅",
                "Aplikasi perlu direstart untuk menerapkan perubahan.",
                [
                    {
                        text: "Restart Sekarang",
                        onPress: async () => {
                            await Updates.reloadAsync();
                        }
                    }
                ]
            );
        } catch (e) {
            Alert.alert("Error", "Gagal mendownload update: " + e);
        }
    };

    return null; // Invisible component
}
