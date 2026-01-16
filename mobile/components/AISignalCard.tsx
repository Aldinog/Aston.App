import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Placeholder Data
const SIGNAL_DATA = {
    symbol: 'BBCA',
    name: 'Bank Central Asia Tbk',
    action: 'BUY',
    entry: '9,850',
    target: '10,200',
    stopLoss: '9,600',
    accuracy: '85%',
    time: '09:00 AM'
};

export default function AISignalCard() {
    return (
        <View className="mx-6 mb-6">
            <View className="flex-row justify-between items-center mb-3">
                <Text className="text-foreground text-lg font-bold">🤖 Aston's Pick</Text>
                <Text className="text-primary text-xs font-medium bg-primary/10 px-2 py-1 rounded-md">Daily Signal</Text>
            </View>

            <TouchableOpacity activeOpacity={0.9}>
                <LinearGradient
                    colors={['#1e293b', '#0f172a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="rounded-2xl p-0.5" // Gradient Border simulator
                >
                    <View className="bg-card rounded-2xl p-4 border border-border/50">
                        {/* Header: Symbol & Action */}
                        <View className="flex-row justify-between items-start mb-4">
                            <View>
                                <Text className="text-foreground text-2xl font-black">{SIGNAL_DATA.symbol}</Text>
                                <Text className="text-muted-foreground text-xs">{SIGNAL_DATA.name}</Text>
                            </View>
                            <View className={`px-4 py-2 rounded-lg ${SIGNAL_DATA.action === 'BUY' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                <Text className={`font-black text-sm ${SIGNAL_DATA.action === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                                    {SIGNAL_DATA.action}
                                </Text>
                            </View>
                        </View>

                        {/* Signal Details */}
                        <View className="flex-row justify-between mb-4 bg-background/50 p-3 rounded-xl">
                            <View className="items-center flex-1">
                                <Text className="text-muted-foreground text-[10px] uppercase">Entry</Text>
                                <Text className="text-foreground font-bold">{SIGNAL_DATA.entry}</Text>
                            </View>
                            <View className="items-center flex-1 border-x border-border/50">
                                <Text className="text-muted-foreground text-[10px] uppercase">Target</Text>
                                <Text className="text-green-500 font-bold">{SIGNAL_DATA.target}</Text>
                            </View>
                            <View className="items-center flex-1">
                                <Text className="text-muted-foreground text-[10px] uppercase">Stop Loss</Text>
                                <Text className="text-red-500 font-bold">{SIGNAL_DATA.stopLoss}</Text>
                            </View>
                        </View>

                        {/* Footer: AI Accuracy & Button */}
                        <View className="flex-row justify-between items-center">
                            <View className="flex-row items-center space-x-1">
                                <Text className="text-xs text-muted-foreground">AI Confidence:</Text>
                                <Text className="text-xs font-bold text-primary">{SIGNAL_DATA.accuracy}</Text>
                            </View>
                            <View className="bg-primary px-4 py-2 rounded-lg">
                                <Text className="text-primary-foreground text-xs font-bold">Analisa Detail →</Text>
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}
