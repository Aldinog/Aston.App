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
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

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
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [symbolToDelete, setSymbolToDelete] = useState<string | null>(null);

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
            // A. Load Full Data from Local Storage (Cache-First)
            const stored = await AsyncStorage.getItem(CACHE_KEY);
            let localSymbols: string[] = [];

            if (stored) {
                const parsed = JSON.parse(stored);

                if (Array.isArray(parsed)) {
                    // Check if format is new (Objects) or old (Strings)
                    if (parsed.length > 0 && typeof parsed[0] === 'object') {
                        // NEW FORMAT: Fully cached data!
                        // 1. Show immediately (Optimistic UI)
                        setWatchlist(parsed);
                        localSymbols = parsed.map((i: any) => i.symbol);
                        setLoading(false); // Content is ready
                    }
                    else if (parsed.length > 0 && typeof parsed[0] === 'string') {
                        // OLD FORMAT: Just symbols
                        localSymbols = parsed;
                        // Don't setWatchlist yet, we need to fetch data
                        setLoading(true);
                    } else if (parsed.length === 0) {
                        setWatchlist([]);
                        setLoading(false);
                        return;
                    }
                }
            } else {
                setLoading(false);
                return;
            }

            // B. Silent Background Fetch (Revalidation)
            const { data: { session } } = await supabase.auth.getSession();
            const headers: any = {};
            if (session) headers['Authorization'] = `Bearer ${session.access_token}`;

            const symbolsParam = localSymbols.join(',');
            // If no symbols, nothing to fetch
            if (!symbolsParam) return;

            const res = await fetch(`${BASE_URL}/api/watchlist?symbols=${symbolsParam}`, { headers });
            const json = await res.json();

            if (json.success) {
                // Update State with Fresh Data
                setWatchlist(json.data);
                // Update Cache with Fresh Data (Full Objects)
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json.data));
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

    const handleDelete = (symbol: string) => {
        setSymbolToDelete(symbol);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!symbolToDelete) return;

        const symbol = symbolToDelete;
        setDeleteModalVisible(false); // Close immediately

        // 1. Update State
        const newList = watchlist.filter(i => i.symbol !== symbol);
        setWatchlist(newList);

        // 2. Update Local Storage (Save Full Objects)
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newList));
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

    const handleOptimisticAdd = async (symbolStr?: string) => {
        if (!symbolStr) {
            fetchWatchlist();
            return;
        }

        const cleanSymbol = symbolStr.toUpperCase();

        // 1. Check Duplicates
        if (watchlist.some(i => i.symbol === cleanSymbol)) {
            Alert.alert("Info", "Stock is already in watchlist");
            return;
        }

        // 2. OPTIMISTIC ADD: Show immediately with placeholder
        const newItem: WatchlistItem = {
            symbol: cleanSymbol,
            price: 0,
            change: 0,
            changePercent: 0,
            sparkline: [],
            description: 'Loading...'
        };

        const optimisticList = [...watchlist, newItem];
        setWatchlist(optimisticList);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(optimisticList));

        // 3. BACKGROUND VALIDATION
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: any = {};
            if (session) headers['Authorization'] = `Bearer ${session.access_token}`;

            // Fetch ONLY this new symbol to validate
            const res = await fetch(`${BASE_URL}/api/watchlist?symbols=${cleanSymbol}`, { headers });
            const json = await res.json();

            // 4. VERIFY & UPDATE or ROLLBACK
            let isValid = false;
            let finalData = newItem;

            if (json.success && json.data && json.data.length > 0) {
                const serverData = json.data[0];
                // Heuristic: If Price AND PrevClose are 0, likely invalid symbol
                if (serverData.price !== 0 || serverData.prevClose !== 0) {
                    isValid = true;
                    finalData = serverData;
                }
            }

            if (isValid) {
                // UPDATE with Real Data
                const validatedList = optimisticList.map(i => i.symbol === cleanSymbol ? finalData : i);
                setWatchlist(validatedList);
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(validatedList));
            } else {
                // ROLLBACK (Delete)
                const rollbackList = optimisticList.filter(i => i.symbol !== cleanSymbol);
                setWatchlist(rollbackList);
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(rollbackList));
                // Notify User
                Alert.alert("Stock Not Found", `Symbol '${cleanSymbol}' is invalid or has no data.`);
            }

        } catch (error) {
            console.error("Optimistic Add Check Error:", error);
            // On Network Error: WE KEEP IT (Optimistic). 
            // Don't delete just because offline. Next refresh will try again.
        }
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
                                onLongPress={() => handleDelete(item.symbol)}
                            />
                        </Swipeable>
                    )}
                />
            )}

            {/* Add Modal */}
            <StockSearchModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onAddSuccess={handleOptimisticAdd}
            />

            {/* Custom Delete Confirmation Modal */}
            <DeleteConfirmationModal
                visible={deleteModalVisible}
                symbol={symbolToDelete}
                onClose={() => setDeleteModalVisible(false)}
                onConfirm={confirmDelete}
            />
        </SafeAreaView>
    );
}
