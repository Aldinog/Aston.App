import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, RefreshControl, TouchableOpacity, Alert, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useTabBar } from '../../context/TabBarContext';
import Animated, { useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

import WatchlistCard from '../../components/WatchlistCard';
import StockSearchModal from '../../components/StockSearchModal';

const { width } = Dimensions.get('window');

// Fallback logic for API URL
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://aston-server.vercel.app';
const BASE_URL = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
const CACHE_KEY = 'watchlist_cache';

interface WatchlistItem {
    symbol: string;
    description?: string;
    price: number;
    change: number;
    changePercent: number;
    sparkline: number[];
    magicScore?: number;
}

export default function Watchlist() {
    const { colorScheme } = useColorScheme();
    const router = useRouter();
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    // -- Dynamic Tab Bar Logic --
    const { tabBarTranslateY } = useTabBar();
    const lastContentOffset = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentY = event.contentOffset.y;
            const diff = currentY - lastContentOffset.value;
            if (diff > 0 && currentY > 50) {
                tabBarTranslateY.value = 120;
            } else if (diff < -5) {
                tabBarTranslateY.value = 0;
            }
            lastContentOffset.value = currentY;
        },
    });

    // 1. Load Cache & Fetch Data
    const fetchWatchlist = async () => {
        try {
            // A. Load Symbols from Local Storage
            const stored = await AsyncStorage.getItem(CACHE_KEY);
            let localSymbols: string[] = [];

            if (stored) {
                const parsed = JSON.parse(stored);
                // Handle both old format (full object) and new format (string array)
                if (Array.isArray(parsed)) {
                    if (parsed.length > 0 && typeof parsed[0] === 'string') {
                        localSymbols = parsed; // New format: ["BBCA", "TLKM"]
                    } else if (parsed.length > 0 && typeof parsed[0] === 'object') {
                        // Migration: Extract symbols from old object cache
                        localSymbols = parsed.map((i: any) => i.symbol);
                        // Save immediately in new format
                        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(localSymbols));
                        setWatchlist(parsed); // Show stale data temporarily
                    }
                }
            }

            if (localSymbols.length === 0) {
                setWatchlist([]);
                setLoading(false);
                setRefreshing(false);
                return;
            }

            // B. Fetch Data from API using Symbols
            const { data: { session } } = await supabase.auth.getSession();
            // Note: We don't block if no session, public/guest might be allowed in future, 
            // but for now let's assume token is needed for API access if enforced by backend.
            const headers: any = {};
            if (session) headers['Authorization'] = `Bearer ${session.access_token}`;

            const symbolsParam = localSymbols.join(',');
            const res = await fetch(`${BASE_URL}/api/watchlist?symbols=${symbolsParam}`, { headers });
            const json = await res.json();

            if (json.success) {
                setWatchlist(json.data);
            }
        } catch (error) {
            console.error('Fetch Watchlist Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchWatchlist();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchWatchlist();
        setTimeout(() => {
            tabBarTranslateY.value = 0;
        }, 500);
    }, []);

    const handleDelete = async (symbol: string) => {
        Alert.alert(
            "Remove Stock",
            `Remove ${symbol} from watchlist?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: 'destructive',
                    onPress: async () => {
                        // 1. Update State
                        const newList = watchlist.filter(i => i.symbol !== symbol);
                        setWatchlist(newList);

                        // 2. Update Local Storage (Save only symbols)
                        const newSymbols = newList.map(i => i.symbol);
                        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newSymbols));
                    }
                }
            ]
        );
    };

    const renderRightActions = (progress: any, dragX: any, symbol: string) => {
        return (
            <TouchableOpacity
                onPress={() => handleDelete(symbol)}
                className="bg-red-500 justify-center items-center w-20 h-full"
            >
                <Ionicons name="trash-outline" size={24} color="white" />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className={`flex-1 bg-background ${colorScheme}`} edges={['top']}>
            {/* Header */}
            <View className="px-5 py-4 flex-row justify-between items-center border-b border-white/5">
                <View>
                    <Text className="text-foreground font-black text-2xl tracking-tight">Watchlist 📈</Text>
                    <Text className="text-muted-foreground text-xs font-medium">
                        {watchlist.length} Stocks Monitored
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setModalVisible(true)}
                    className="w-10 h-10 bg-primary/20 rounded-full justify-center items-center active:scale-95"
                >
                    <Ionicons name="add" size={24} color="#10B981" />
                </TouchableOpacity>
            </View>

            {/* List */}
            {watchlist.length === 0 && !loading ? (
                <View className="flex-1 justify-center items-center opacity-50">
                    <Ionicons name="list" size={64} color="#64748b" />
                    <Text className="text-muted-foreground mt-4">Your watchlist is empty.</Text>
                    <TouchableOpacity onPress={() => setModalVisible(true)} className="mt-4 bg-primary px-6 py-2 rounded-full">
                        <Text className="text-white font-bold">Add One</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <Animated.FlatList
                    data={watchlist}
                    keyExtractor={(item) => item.symbol}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colorScheme === 'dark' ? '#fff' : '#000'} />
                    }
                    renderItem={({ item }) => (
                        <Swipeable renderRightActions={(p, d) => renderRightActions(p, d, item.symbol)}>
                            <WatchlistCard
                                symbol={item.symbol}
                                description={item.description}
                                price={item.price}
                                change={item.change}
                                changePercent={item.changePercent}
                                sparkline={item.sparkline}
                                magicScore={item.magicScore}
                                onPress={() => router.push({ pathname: '/chart-pro', params: { symbol: item.symbol } })}
                            />
                        </Swipeable>
                    )}
                />
            )}

            {/* Add Modal */}
            <StockSearchModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onAddSuccess={fetchWatchlist}
            />
        </SafeAreaView>
    );
}
