import { View, Text, SafeAreaView } from 'react-native';
import { useColorScheme } from 'nativewind';

export default function AskAI() {
    const { colorScheme } = useColorScheme();
    return (
        <SafeAreaView className={`flex-1 bg-background ${colorScheme}`}>
            <View className="flex-1 justify-center items-center">
                <Text className="text-foreground text-xl">Ask AI Chat (Coming Soon)</Text>
            </View>
        </SafeAreaView>
    );
}
