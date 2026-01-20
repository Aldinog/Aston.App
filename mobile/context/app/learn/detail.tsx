import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, SafeAreaView, Image } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LEARN_MODULES } from '../../data/learnContent';

export default function LearnDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { id } = params;

    const moduleData = LEARN_MODULES.find(m => m.id === id);

    if (!moduleData) {
        return (
            <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center">
                <Text className="text-white">Modul tidak ditemukan: {id}</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4 p-2 bg-slate-800 rounded">
                    <Text className="text-white">Kembali</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // --- STATE ---
    const [selectedImage, setSelectedImage] = useState<any>(null);

    // --- RENDERERS ---

    // 1. Grid Image (Candlesticks) -> Refactored to Full Width List
    const renderGridImage = () => (
        <View className="flex-col">
            {moduleData.content.map((item: any, index: number) => (
                <View key={index} className="bg-slate-800/50 rounded-2xl p-4 mb-8 border border-white/5">
                    {/* Header: Title & Badge */}
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-white font-bold text-xl flex-1 mr-2">{item.title}</Text>
                        {item.type && (
                            <View className={`px-2 py-1 rounded-lg ${item.type === 'BULLISH' ? 'bg-emerald-500/20' : item.type === 'BEARISH' ? 'bg-red-500/20' : 'bg-slate-500/20'}`}>
                                <Text className={`text-xs font-bold ${item.type === 'BULLISH' ? 'text-emerald-400' : item.type === 'BEARISH' ? 'text-red-400' : 'text-slate-400'}`}>
                                    {item.type}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Image Area (Clickable) */}
                    <TouchableOpacity
                        onPress={() => item.image && setSelectedImage(item.image)}
                        activeOpacity={0.9}
                        className="h-48 bg-slate-900/50 rounded-xl mb-4 items-center justify-center border border-dashed border-slate-700 overflow-hidden"
                    >
                        {item.image ? (
                            <Image source={item.image} className="w-full h-full" resizeMode="contain" />
                        ) : (
                            <View className="items-center">
                                <Ionicons name="image-outline" size={32} color="#475569" />
                                <Text className="text-slate-600 text-xs mt-2">Tap to see pattern</Text>
                            </View>
                        )}
                        {item.image && (
                            <View className="absolute bottom-2 right-2 bg-black/50 p-1 rounded-full">
                                <Ionicons name="scan-outline" size={16} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Description */}
                    <Text className="text-slate-300 text-base leading-6">{item.desc}</Text>
                </View>
            ))}
        </View>
    );

    // 2. Guide List (App Guide)
    const renderGuide = () => (
        <View>
            {moduleData.content.map((item: any, index: number) => (
                <View key={index} className="bg-slate-800/30 rounded-2xl p-5 mb-4 border border-white/5">
                    <Text className="text-blue-400 font-bold text-lg mb-3">{index + 1}. {item.title}</Text>
                    {item.steps.map((step: string, sIndex: number) => (
                        <View key={sIndex} className="flex-row mb-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2 mr-3" />
                            <Text className="text-slate-300 flex-1 leading-5">{step}</Text>
                        </View>
                    ))}
                </View>
            ))}
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-900 pt-10">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* --- IMAGE ZOOM MODAL --- */}
            {selectedImage && (
                <View className="absolute inset-0 z-50 bg-black justify-center items-center">
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }}
                        onPress={() => setSelectedImage(null)}
                        className="bg-white/10 p-2 rounded-full"
                    >
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>

                    <Image
                        source={selectedImage}
                        style={{ width: '100%', height: '80%' }}
                        resizeMode="contain"
                    />

                    <Text className="text-slate-500 absolute bottom-10 text-sm">Tap close button to return</Text>
                </View>
            )}

            {/* --- HEADER --- */}
            <View className="px-5 pb-4 flex-row items-center space-x-3">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-xl border border-white/5">
                    <Ionicons name="arrow-back" size={20} color="white" />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-white flex-1" numberOfLines={1}>{moduleData.title}</Text>
            </View>

            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
                <Text className="text-slate-400 mb-6 text-base">{moduleData.description}</Text>

                {moduleData.type === 'GRID_IMAGE' && renderGridImage()}
                {moduleData.type === 'GUIDE' && renderGuide()}

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
