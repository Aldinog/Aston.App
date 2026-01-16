import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function AISignalCard() {
    const [signal, setSignal] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [detailVisible, setDetailVisible] = useState(false);

    useEffect(() => {
        fetchSignal();
    }, []);

    const fetchSignal = async () => {
        try {
            const { data, error } = await supabase
                .from('daily_signals')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (data) setSignal(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="mx-6 mb-6 h-48 bg-card/50 rounded-2xl justify-center items-center">
                <ActivityIndicator color="gray" />
                <Text className="text-muted-foreground text-xs mt-2">Connecting to Aston Brain...</Text>
            </View>
        );
    }

    if (!signal || signal.status === 'WAIT') {
        return (
            <View className="mx-6 mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-foreground text-lg font-bold">🤖 Aston's Pick</Text>
                    <Text className="text-muted-foreground text-xs font-medium bg-muted/20 px-2 py-1 rounded-md">No Active Signal</Text>
                </View>
                <View className="bg-card rounded-2xl p-6 border border-border/50 items-center">
                    <MaterialCommunityIcons name="shield-check-outline" size={48} color="#64748b" />
                    <Text className="text-foreground font-bold text-base mt-2">Mode Bertahan: Cash is King</Text>
                    <Text className="text-muted-foreground text-center text-xs mt-1">
                        Sistem tidak menemukan setup High Probability hari ini. Disarankan Wait & See.
                    </Text>
                </View>
            </View>
        );
    }

    // Colors
    let colors = ['#1e293b', '#0f172a'];
    let badgeColor = 'bg-primary/20 text-primary';
    let statusIcon = null;

    if (signal.status === 'HIT_TP') {
        colors = ['#065f46', '#064e3b'];
        badgeColor = 'bg-green-500/20 text-green-500';
        statusIcon = <MaterialCommunityIcons name="check-circle" size={20} color="#4ade80" />;
    } else if (signal.status === 'HIT_SL') {
        colors = ['#7f1d1d', '#450a0a'];
        badgeColor = 'bg-red-500/20 text-red-500';
        statusIcon = <MaterialCommunityIcons name="close-circle" size={20} color="#f87171" />;
    }

    return (
        <View className="mx-6 mb-6">
            <View className="flex-row justify-between items-center mb-3">
                <Text className="text-foreground text-lg font-bold">🤖 Aston's Pick</Text>
                <View className="flex-row items-center space-x-1">
                    {statusIcon}
                    <Text className={`${badgeColor} text-xs font-bold px-2 py-1 rounded-md ml-1 overflow-hidden`}>
                        {signal.status === 'OPEN' ? 'Active Signal' : signal.status.replace('_', ' ')}
                    </Text>
                </View>
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={() => setDetailVisible(true)}>
                <LinearGradient
                    colors={colors as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="rounded-2xl p-0.5"
                >
                    <View className="bg-card rounded-2xl p-4 border border-border/10">
                        {/* Header */}
                        <View className="flex-row justify-between items-start mb-4">
                            <View>
                                <Text className="text-white text-2xl font-black">{signal.symbol?.replace('.JK', '')}</Text>
                                <Text className="text-gray-400 text-xs">{signal.company_name || 'Daily Pick'}</Text>
                            </View>
                            <View className={`px-4 py-2 rounded-lg ${signal.action === 'BUY' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                <Text className={`font-black text-sm ${signal.action === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                                    {signal.action}
                                </Text>
                            </View>
                        </View>

                        {/* Quick Stats */}
                        <View className="flex-row justify-between mb-4 bg-black/20 p-3 rounded-xl">
                            <View className="items-center flex-1">
                                <Text className="text-gray-400 text-[10px] uppercase">Entry</Text>
                                <Text className="text-white font-bold">{signal.entry_price}</Text>
                            </View>
                            <View className="items-center flex-1 border-x border-white/10">
                                <Text className="text-gray-400 text-[10px] uppercase">Target</Text>
                                <Text className="text-green-400 font-bold">{signal.target_price}</Text>
                            </View>
                            <View className="items-center flex-1">
                                <Text className="text-gray-400 text-[10px] uppercase">Stop Loss</Text>
                                <Text className="text-red-400 font-bold">{signal.stop_loss}</Text>
                            </View>
                        </View>

                        {/* Summary & Button */}
                        <View className="flex-row justify-between items-end">
                            <View className="flex-1 mr-2">
                                <Text className="text-xs text-gray-400 mb-1">AI Confidence: <Text className="text-blue-400 font-bold">{signal.ai_confidence}</Text></Text>
                                <Text className="text-gray-300 text-xs italic" numberOfLines={2}>"{signal.analysis_summary}"</Text>
                            </View>
                            <View className="bg-white/10 p-2 rounded-full">
                                <MaterialCommunityIcons name="arrow-right" size={20} color="white" />
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>

            {/* DETAIL MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={detailVisible}
                onRequestClose={() => setDetailVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setDetailVisible(false)}>
                    <View className="flex-1 justify-end bg-black/60">
                        <TouchableWithoutFeedback>
                            <View className="bg-card rounded-t-3xl p-6 h-[70%] border-t border-border/20">
                                <View className="items-center mb-6">
                                    <View className="w-12 h-1 bg-muted rounded-full mb-4" />
                                    <Text className="text-2xl font-bold text-foreground">{signal.symbol?.replace('.JK', '')} Analysis</Text>
                                    <Text className="text-muted-foreground text-xs">Generated by Aston AI • {new Date(signal.created_at).toLocaleDateString()}</Text>
                                </View>

                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {/* Level Card */}
                                    <View className="bg-muted/10 p-4 rounded-xl mb-6 flex-row justify-between">
                                        <View>
                                            <Text className="text-muted-foreground text-xs">Entry Area</Text>
                                            <Text className="text-foreground text-lg font-bold">{signal.entry_price}</Text>
                                        </View>
                                        <View>
                                            <Text className="text-muted-foreground text-xs">Target Profit</Text>
                                            <Text className="text-green-500 text-lg font-bold">{signal.target_price}</Text>
                                        </View>
                                        <View>
                                            <Text className="text-muted-foreground text-xs">Stop Loss</Text>
                                            <Text className="text-red-500 text-lg font-bold">{signal.stop_loss}</Text>
                                        </View>
                                    </View>

                                    <Text className="text-foreground font-bold mb-2 text-lg">📝 AI Summary</Text>
                                    <Text className="text-muted-foreground leading-6 mb-6">
                                        {signal.analysis_summary}
                                    </Text>

                                    <View className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 mb-6">
                                        <View className="flex-row items-center mb-2">
                                            <MaterialCommunityIcons name="brain" size={20} color="#3b82f6" />
                                            <Text className="text-blue-500 font-bold ml-2">Why this pick?</Text>
                                        </View>
                                        <Text className="text-blue-200 text-xs">
                                            This stock was selected from the Top 80 Liquid Stocks (IDX80) based on High Volume Flow (&gt;1.2x Avg) and Bullish Momentum Structure.
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        className="bg-primary w-full py-4 rounded-xl items-center mb-8"
                                        onPress={() => setDetailVisible(false)}
                                    >
                                        <Text className="text-primary-foreground font-bold">Mengerti, Tutup.</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}
