import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StatusBar, SafeAreaView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LEARN_MODULES } from '../../data/learnContent';

export default function GlossaryScreen() {
    const router = useRouter();
    const [search, setSearch] = useState('');

    // Get Glossary Content
    const moduleData = LEARN_MODULES.find(m => m.id === 'glossary');
    const terms = moduleData ? moduleData.content : [];

    // Filter
    const filteredTerms = terms.filter((item: any) =>
        item.term.toLowerCase().includes(search.toLowerCase()) ||
        item.def.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-900 pt-10">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* --- HEADER --- */}
            <View className="px-5 pb-4">
                <View className="flex-row items-center space-x-3 mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-xl border border-white/5">
                        <Ionicons name="arrow-back" size={20} color="white" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-white">Kamus Trader</Text>
                </View>

                {/* SEARCH */}
                <View className="flex-row items-center bg-slate-800/80 rounded-xl px-4 py-3 border border-white/5">
                    <Ionicons name="search" size={20} color="#94a3b8" />
                    <TextInput
                        className="flex-1 ml-3 text-white font-medium"
                        placeholder="Cari istilah (contoh: ARA)"
                        placeholderTextColor="#64748b"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
                {filteredTerms.length === 0 ? (
                    <View className="mt-10 items-center">
                        <Text className="text-slate-500">Istilah tidak ditemukan.</Text>
                    </View>
                ) : (
                    filteredTerms.map((item: any, index: number) => (
                        <View key={index} className="bg-slate-800/30 rounded-xl p-4 mb-3 border border-white/5">
                            <Text className="text-amber-400 font-bold text-lg mb-1">{item.term}</Text>
                            <Text className="text-slate-300 leading-5">{item.def}</Text>
                        </View>
                    ))
                )}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
