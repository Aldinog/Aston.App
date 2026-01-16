import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import PromoBanner from '../../components/PromoBanner';
import MarketPulse from '../../components/MarketPulse';
import AISignalCard from '../../components/AISignalCard';
import QuickMenu from '../../components/QuickMenu';
import TrendingList from '../../components/TrendingList';

export default function Home() {
    const { colorScheme } = useColorScheme();

    return (
        <SafeAreaView className={`flex-1 bg-background ${colorScheme}`} edges={['top']}>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
                {/* 1. Header Section */}
                <View className="px-6 pt-2 pb-4 flex-row justify-between items-center mb-2 mt-12">
                    <View>
                        <Text className="text-foreground font-black text-2xl tracking-tighter">ASTON TRADE</Text>
                        <Text className="text-muted-foreground text-sm font-medium">Welcome back, Trader!</Text>
                    </View>
                    <View className="w-10 h-10 bg-card border border-border rounded-full justify-center items-center shadow-sm">
                        <Text>🔔</Text>
                    </View>
                </View>

                {/* 2. Promo Banner (Automated) */}
                <PromoBanner />

                {/* 3. Market Pulse */}
                <View className="px-6 mt-2 mb-4">
                    <Text className="text-foreground text-lg font-bold mb-3">Market Pulse</Text>
                    <MarketPulse />
                </View>

                {/* 4. AI Signal Card */}
                <AISignalCard />

                {/* 5. Quick Actions */}
                <QuickMenu />

                {/* 6. Trending List */}
                <View className="mt-2">
                    <View className="px-6 mb-3 flex-row justify-between items-center">
                        <Text className="text-foreground text-lg font-bold">Trending Now 🔥</Text>
                        <Text className="text-primary text-xs font-bold">View All</Text>
                    </View>
                    <TrendingList />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
