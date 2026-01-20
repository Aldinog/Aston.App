import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { LineChart } from 'react-native-wagmi-charts';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useRouter } from 'expo-router';
import { curveLinear } from 'd3-shape';

const { width } = Dimensions.get('window');

interface WatchlistCardProps {
    symbol: string;
    description?: string;
    price: number;
    change: number;
    changePercent: number;
    sparkline: number[];
    magicScore?: number;
    onPress: () => void;
    onLongPress?: () => void;
}

export default function WatchlistCard({ symbol, description, price, change, changePercent, sparkline, magicScore, onPress, onLongPress }: WatchlistCardProps) {
    const { colorScheme } = useColorScheme();

    // --- Trend Logic for Chart ---
    // If sparkline exists, compare last vs first point to determine trend color
    // This gives a better "weekly/h1 trend" view than just daily change
    const isChartUp = sparkline.length > 1
        ? sparkline[sparkline.length - 1] >= sparkline[0]
        : change >= 0;

    const chartColor = isChartUp ? '#10B981' : '#EF4444'; // Emerald vs Red for Chart

    // --- Daily Change Color ---
    // Price text still follows daily change
    const isDailyUp = change >= 0;
    const priceColor = isDailyUp ? '#10B981' : '#EF4444';

    // Prepare data for wagmi chart
    // Filter out 0 or null values to prevent line breaking/dropping to zero
    const validSparkline = sparkline.filter(val => val > 0);

    const chartData = validSparkline.length > 0
        ? validSparkline.map((val, idx) => ({ timestamp: idx, value: val }))
        : Array.from({ length: 30 }).map((_, i) => ({ timestamp: i, value: price })); // 30 points placeholder

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={500}
            className="flex-row items-center justify-between py-4 px-1 border-b border-white/5 bg-background"
        >
            {/* Left: Info & AI Score */}
            <View className="flex-1 mr-2">
                <View className="flex-row items-center mb-1">
                    <Text className="text-foreground font-bold text-lg mr-2">{symbol.replace('.JK', '')}</Text>
                    {magicScore !== undefined && magicScore > 0 && (
                        <View className={`px-1.5 py-0.5 rounded-md border ${magicScore >= 80 ? 'bg-amber-500/20 border-amber-500' : 'bg-slate-700/50 border-slate-600'}`}>
                            <Text className={`text-[10px] font-bold ${magicScore >= 80 ? 'text-amber-400' : 'text-slate-400'}`}>
                                AI {magicScore}
                            </Text>
                        </View>
                    )}
                </View>
                <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                    {description || 'Indonesia Stock'}
                </Text>
            </View>

            {/* Middle: Sparkline H1 (30 Candles) */}
            <View className="w-24 h-12 mr-2 justify-center overflow-hidden pt-1">
                <LineChart.Provider data={chartData}>
                    <LineChart width={80} height={30} yGutter={10}>
                        <LineChart.Path color={chartColor} width={2} shape={curveLinear}>
                            <LineChart.Gradient color={chartColor} />
                        </LineChart.Path>
                    </LineChart>
                </LineChart.Provider>
            </View>

            {/* Right: Price & Change */}
            <View className="items-end min-w-[80px]">
                <Text className="text-foreground font-bold text-base">
                    {new Intl.NumberFormat('id-ID').format(price)}
                </Text>

                <View className={`flex-row items-center mt-1 px-1.5 py-0.5 rounded-md ${isDailyUp ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                    <Ionicons name={isDailyUp ? 'caret-up' : 'caret-down'} size={10} color={priceColor} style={{ marginRight: 2 }} />
                    <Text style={{ color: priceColor, fontSize: 11, fontWeight: '700' }}>
                        {Math.abs(changePercent).toFixed(2)}%
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}
