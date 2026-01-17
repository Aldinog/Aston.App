import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, StatusBar, SafeAreaView, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// Helper to color code Magic Score
const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-slate-500';
};

const SECTORS = ['All', 'Finance', 'Energy', 'Consumer', 'Infrastructure', 'Basic Material', 'Industrial', 'Technology', 'Healthcare'];

interface ScreenerResult {
    symbol: string;
    sector: string;
    pattern: string;
    signalType: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    magicScore: number;
    isHotVolume: boolean;
    price: number;
    change: string;
    rsi: string;
    volume: number;
    reason: string;
}

export default function ScreenerScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState<ScreenerResult[]>([]);
    const [activeSector, setActiveSector] = useState('All');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchScreener(activeSector);
    }, [activeSector]);

    const fetchScreener = async (sector: string) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('https://aston-server.vercel.app/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'screener', sector: sector })
            });
            const json = await res.json();
            if (json.success && json.data) {
                setResults(json.data);
            } else {
                setResults([]);
            }
        } catch (e) {
            console.error("Screener Fetch Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchScreener(activeSector);
    };

    const renderItem = ({ item }: { item: ScreenerResult }) => (
        <TouchableOpacity
            onPress={() => router.push({ pathname: '/chart-pro', params: { symbol: item.symbol } })}
            className="bg-slate-800/50 mb-3 rounded-2xl p-4 border border-white/5 active:bg-slate-800"
        >
            <View className="flex-row justify-between items-start mb-2">
                <View>
                    <View className="flex-row items-center space-x-2">
                        <Text className="text-white text-lg font-bold">{item.symbol.replace('.JK', '')}</Text>
                        <View className={`px-2 py-0.5 rounded-full ${item.signalType === 'BULLISH' ? 'bg-emerald-500/20' : item.signalType === 'BEARISH' ? 'bg-red-500/20' : 'bg-slate-500/20'}`}>
                            <Text className={`text-[10px] font-bold ${item.signalType === 'BULLISH' ? 'text-emerald-400' : item.signalType === 'BEARISH' ? 'text-red-400' : 'text-slate-400'}`}>
                                {item.signalType}
                            </Text>
                        </View>
                    </View>
                    <Text className="text-slate-400 text-xs mt-0.5">{item.sector}</Text>
                </View>

                <View className="items-end">
                    <Text className="text-white font-bold text-base">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.price)}
                    </Text>
                    <Text className={`text-xs font-bold ${parseFloat(item.change) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {parseFloat(item.change) >= 0 ? '+' : ''}{item.change}%
                    </Text>
                </View>
            </View>

            {/* --- BADGES & REASON --- */}
            <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-white/5">
                <View className="flex-row space-x-2">
                    {/* Magic Score Badge */}
                    <View className={`flex-row items-center px-2 py-1 rounded-lg ${getScoreColor(item.magicScore)}`}>
                        <Ionicons name="sparkles" size={10} color="white" />
                        <Text className="text-white text-[10px] font-bold ml-1">Score: {item.magicScore}</Text>
                    </View>

                    {/* Hot Volume Badge */}
                    {item.isHotVolume && (
                        <View className="flex-row items-center px-2 py-1 rounded-lg bg-orange-500">
                            <Ionicons name="flame" size={10} color="white" />
                            <Text className="text-white text-[10px] font-bold ml-1">Hot Vol</Text>
                        </View>
                    )}
                </View>

                {/* Signal Text */}
                <Text className="text-slate-300 text-xs font-medium italic max-w-[50%]" numberOfLines={1}>
                    {item.reason}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-900 pt-10">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* --- HEADER --- */}
            <View className="px-5 pb-4 flex-row items-center justify-between z-10">
                <View className="flex-row items-center space-x-3">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-xl border border-white/5">
                        <Ionicons name="arrow-back" size={20} color="white" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-white">Market Screener</Text>
                </View>
                {/* Optional: Filter Icon or Search */}
            </View>

            {/* --- SECTOR FILTER --- */}
            <View className="mb-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-5" contentContainerStyle={{ paddingRight: 20 }}>
                    {SECTORS.map((sector) => (
                        <TouchableOpacity
                            key={sector}
                            onPress={() => setActiveSector(sector)}
                            className={`mr-2 px-4 py-2 rounded-full border ${activeSector === sector ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-white/10'}`}
                        >
                            <Text className={`font-bold text-xs ${activeSector === sector ? 'text-white' : 'text-slate-400'}`}>
                                {sector}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* --- LIST --- */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4f46e5" />
                    <Text className="text-slate-400 mt-4 text-sm">Scanning Market Data...</Text>
                    <Text className="text-slate-600 text-xs">Looking for patterns & anomalies</Text>
                </View>
            ) : results.length === 0 ? (
                <View className="flex-1 justify-center items-center px-10">
                    <MaterialCommunityIcons name="radar" size={64} color="#334155" />
                    <Text className="text-slate-400 mt-4 text-center font-bold text-lg">No Signals Found</Text>
                    <Text className="text-slate-500 text-center text-sm mt-2">
                        Try changing the sector filter or come back later when the market is more active.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.symbol}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                    }
                />
            )}
        </SafeAreaView>
    );
}
