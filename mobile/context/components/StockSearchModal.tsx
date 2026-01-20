import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StockSearchModalProps {
    visible: boolean;
    onClose: () => void;
    onAddSuccess: (symbol?: string) => void;
}

export default function StockSearchModal({ visible, onClose, onAddSuccess }: StockSearchModalProps) {
    const { colorScheme } = useColorScheme();
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!symbol.trim()) return;

        // Optimistic Handoff: Immediate close & trigger parent
        const cleanSymbol = symbol.trim().toUpperCase();

        // Passing symbol to parent to handle "Add -> Validate -> Rollback"
        onAddSuccess(cleanSymbol);

        setSymbol('');
        onClose();
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
