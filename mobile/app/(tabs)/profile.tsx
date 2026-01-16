import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'expo-router';

export default function Profile() {
    const { colorScheme } = useColorScheme();
    const router = useRouter();

    async function handleLogout() {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
    }

    return (
        <SafeAreaView className={`flex-1 bg-background ${colorScheme}`}>
            <View className="flex-1 justify-center items-center">
                <Text className="text-foreground text-xl mb-4">Profile (Coming Soon)</Text>
                <TouchableOpacity onPress={handleLogout} className="bg-destructive px-4 py-2 rounded-lg">
                    <Text className="text-destructive-foreground font-bold">Logout</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
