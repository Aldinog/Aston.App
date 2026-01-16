import { Redirect } from "expo-router";
import { View, Text } from "react-native";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Index() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
    }, []);

    if (loading) {
        return (
            <View className="flex-1 bg-background justify-center items-center">
                <Text className="text-white">Loading...</Text>
            </View>
        );
    }

    if (session && session.user) {
        return <Redirect href="/(tabs)/home" />;
    }

    return <Redirect href="/(auth)/login" />;
}
