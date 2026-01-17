import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, SafeAreaView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LEARN_MODULES } from '../../data/learnContent';

export default function LearnMenuScreen() {
    const router = useRouter();

    const handlePress = (module: any) => {
        if (module.id === 'glossary') {
            router.push('/learn/glossary');
        } else {
            // Generic renderer for GRID_IMAGE, GUIDE, etc.
            router.push({ pathname: '/learn/detail', params: { id: module.id } });
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-900 pt-10">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* --- HEADER --- */}
            <View className="px-5 pb-6 pt-2">
                <View className="flex-row items-center space-x-3 mb-2">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-xl border border-white/5">
                        <Ionicons name="arrow-back" size={20} color="white" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-white">Pusat Edukasi</Text>
                </View>
                <Text className="text-slate-400 text-sm ml-1">Belajar trading dari nol sampai pro.</Text>
            </View>

            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
                {LEARN_MODULES.map((module) => (
                    <TouchableOpacity
                        key={module.id}
                        onPress={() => handlePress(module)}
                        className="bg-slate-800/50 rounded-2xl p-5 mb-4 border border-white/5 flex-row items-center active:bg-slate-800"
                    >
                        <View className={`w-12 h-12 rounded-xl justify-center items-center opacity-90`} style={{ backgroundColor: module.color + '20' }}>
                            <MaterialCommunityIcons name={module.icon as any} size={28} color={module.color} />
                        </View>

                        <View className="flex-1 ml-4">
                            <Text className="text-white font-bold text-lg">{module.title}</Text>
                            <Text className="text-slate-400 text-xs mt-1" numberOfLines={2}>{module.description}</Text>
                        </View>

                        <Ionicons name="chevron-forward" size={20} color="#64748b" />
                    </TouchableOpacity>
                ))}

                {/* --- COMING SOON --- */}
                <View className="mt-4 p-5 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700 items-center">
                    <Text className="text-slate-500 font-bold text-sm">Modul Baru Segera Hadir!</Text>
                    <Text className="text-slate-600 text-xs mt-1">Psikologi Trading & Money Management</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
