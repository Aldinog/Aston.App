import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StockSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onAddSuccess: () => void;
}

export default function StockSearchModal({ visible, onClose, onAddSuccess }: StockSearchModalProps) {
    const { colorScheme } = useColorScheme();
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!symbol.trim()) return;
        setLoading(true);
        setError(null);

        const cleanSymbol = symbol.trim().toUpperCase();

        try {
            // 1. Check Local Duplicate
            const CACHE_KEY = 'watchlist_cache';
            const stored = await AsyncStorage.getItem(CACHE_KEY);
            let currentList: string[] = [];

            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    // Handle migration if needed, but assuming mostly strings or empty
                    if (parsed.length > 0 && typeof parsed[0] === 'object') {
                        currentList = parsed.map((i: any) => i.symbol);
                    } else {
                        currentList = parsed;
                    }
                }
            }

            if (currentList.includes(cleanSymbol)) {
                throw new Error("Stock already in watchlist");
            }

            // 2. Validate via Backend (GET)
            const { data: { session } } = await supabase.auth.getSession();
            const headers: any = {};
            if (session) headers['Authorization'] = `Bearer ${session.access_token}`;

            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://aston-server.vercel.app';
            const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

            // Fetch data for this single symbol to validate and get initial data
            const res = await fetch(`${baseUrl}/api/watchlist?symbols=${cleanSymbol}`, { headers });
            const json = await res.json();

            if (!json.success || !json.data || json.data.length === 0) {
                throw new Error("Stock not found or invalid");
            }

            const data = json.data[0];
            if (data.price === 0 && data.prevClose === 0) {
                // Soft check: sometimes valid stocks have 0 price if no data yet, but usually means invalid
                // throw new Error("Stock data unavailable");
            }

            // 3. Save to Local Storage
            const newList = [...currentList, cleanSymbol];
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newList));

            setSymbol('');
            onAddSuccess(); // Refresh parent
            onClose();

        } catch (err: any) {
            console.error("Add Stock Error:", err);
            setError(err.message || "Failed to add stock. Check symbol.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end bg-black/80"
            >
                <View className={`bg-card rounded-t-3xl p-6 ${colorScheme} border-t border-border`}>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-foreground text-xl font-bold">Add to Watchlist 📈</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={28} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-muted-foreground mb-2">Enter Stock Symbol (e.g. BBCA, TLKM)</Text>
                    <View className="flex-row items-center space-x-3 mb-4">
                        <TextInput
                            value={symbol}
                            onChangeText={(text) => {
                                setSymbol(text);
                                setError(null);
                            }}
                            placeholder="Stock Symbol..."
                            placeholderTextColor="#64748b"
                            autoCapitalize="characters"
                            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground font-bold text-lg"
                            onSubmitEditing={handleAdd}
                        />
                        <TouchableOpacity
                            onPress={handleAdd}
                            disabled={loading || !symbol.trim()}
                            className={`px-5 py-3 rounded-xl justify-center items-center ${loading || !symbol.trim() ? 'bg-slate-700' : 'bg-primary'}`}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Ionicons name="add" size={24} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {error && (
                        <View className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg mb-4">
                            <Text className="text-red-500 text-sm font-medium text-center">{error}</Text>
                        </View>
                    )}

                    {/* Quick Tips */}
                    <Text className="text-slate-500 text-xs text-center mt-2">
                        Tip: You can add US stocks (AAPL) or Indo stocks (BBCA.JK).
                    </Text>
                    <View style={{ height: 20 }} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
