import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

// Simple API Helper (Inline for now to ensure it works)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://bot-ai-backend.vercel.app/api';

// Fallback Mock Data (AI Hot Picks)
const MOCK_DATA = [
    { symbol: 'BBCA', price: 9200, change: 1.5, magicScore: 98, sector: 'Finance' },
    { symbol: 'ADRO', price: 2450, change: 3.2, magicScore: 95, sector: 'Energy' },
    { symbol: 'TLKM', price: 3400, change: -0.5, magicScore: 88, sector: 'Infra' },
    { symbol: 'GOTO', price: 82, change: 5.1, magicScore: 85, sector: 'Tech' },
    { symbol: 'ASII', price: 5600, change: 0.0, magicScore: 80, sector: 'Industrial' },
];

export default function TrendingList() {
    const router = useRouter();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrending();
    }, []);

    const fetchTrending = async () => {
        try {
            console.log("Fetching Trending AI from:", `${API_URL}/api/web?action=trending-ai`);
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch(`${API_URL}/api/web`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'trending-ai' })
            });

            // Handle non-JSON response (e.g. 404/500 from Vercel)
            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch (e) {
                console.warn("Trending API returned non-JSON:", text.substring(0, 100));
                throw new Error("Invalid JSON response");
            }

            if (json.success) {
                setData(json.data);
            } else {
                throw new Error(json.error || "Unknown API error");
            }
        } catch (error) {
            console.warn('Using Mock Data for Trending (Backend not ready/deployed):', error);
            setData(MOCK_DATA);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="px-6 h-40 justify-center items-center">
                <ActivityIndicator color="#F59E0B" />
                <Text className="text-slate-500 text-xs mt-2">Scanning AI Picks...</Text>
            </View>
        );
    }

    if (data.length === 0) {
        return (
            <View className="px-6 h-20 justify-center">
                <Text className="text-slate-500 text-sm">No hot picks available right now.</Text>
            </View>
        );
    }

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}
            className="flex-row"
        >
            {data.map((item, index) => {
                const cleanSymbol = item.symbol.replace('.JK', '');
                return (
                    <TouchableOpacity
                        key={index}
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/chart-pro', params: { symbol: item.symbol } })}
                        className="w-36 bg-slate-900 border border-white/10 p-3 rounded-2xl mr-3 shadow-sm"
                    >
                        {/* Top: AI Score */}
                        <View className="flex-row justify-between items-start mb-2">
                            <View className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                                <Text className="font-bold text-white text-[10px]">{cleanSymbol.substring(0, 2)}</Text>
                            </View>
                            <View className="bg-amber-500/20 px-2 py-1 rounded-md border border-amber-500/30">
                                <Text className="text-amber-400 font-extrabold text-[10px]">AI {item.magicScore}</Text>
                            </View>
                        </View>

                        {/* Middle: Info */}
                        <Text className="text-white font-bold text-lg mb-0.5">{cleanSymbol}</Text>
                        <Text className="text-slate-400 text-xs mb-2" numberOfLines={1}>{item.sector || 'Stock'}</Text>

                        {/* Bottom: Price */}
                        <View className="flex-row items-baseline space-x-1">
                            <Text className="text-slate-200 font-bold text-sm">
                                {new Intl.NumberFormat('id-ID').format(item.price)}
                            </Text>
                            <Text className={`text-[10px] font-bold ${item.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {item.change > 0 ? '+' : ''}{item.change}%
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}
