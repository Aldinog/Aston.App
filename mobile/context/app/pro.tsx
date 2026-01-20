import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar, SafeAreaView, Dimensions, Alert, Modal } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const PLANS = [
    { id: 'trial', duration: '7 Days', label: 'Free Trial', price: 0, distinct: false, save: null },
    { id: '1m', duration: '1 Bulan', label: 'Starter', price: 159000, original: 199000, save: '20%', distinct: false },
    { id: '3m', duration: '3 Bulan', label: 'Popular', price: 359000, original: 597000, save: '40%', distinct: false },
    { id: '6m', duration: '6 Bulan', label: 'Best Value', price: 599000, original: 1194000, save: '50%', distinct: true },
    { id: '1y', duration: '1 Tahun', label: 'Super Saver', price: 699000, original: 2388000, save: '70%', distinct: true },
];

export default function ProScreen() {
    const router = useRouter();
    const [selectedPlan, setSelectedPlan] = useState('1y');
    const [showModal, setShowModal] = useState(false);

    const handleSubscribe = () => {
        setShowModal(true);
    };

    const confirmPayment = () => {
        setShowModal(false);
        console.log("Payment flow for:", selectedPlan);
        // Implement payment logic here
        Alert.alert("Success", "Redirecting to payment gateway...");
    };

    const formatCurrency = (val: number) => {
        if (val === 0) return 'Gratis';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    };

    const getSelectedPlanDetails = () => PLANS.find(p => p.id === selectedPlan);
    const planDetails = getSelectedPlanDetails();

    return (
        <SafeAreaView className="flex-1 bg-black pt-10">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* --- CONFIRMATION MODAL --- */}
            <Modal
                visible={showModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <View className="flex-1 bg-black/80 justify-center items-center px-5">
                    <View className="w-full bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl shadow-amber-500/20">
                        {/* Header */}
                        <View className="items-center mb-6">
                            <View className="bg-amber-500/20 p-4 rounded-full mb-3 border border-amber-500/50">
                                <MaterialCommunityIcons name="crown" size={32} color="#fbbf24" />
                            </View>
                            <Text className="text-white text-xl font-bold">Konfirmasi Langganan</Text>
                            <Text className="text-slate-400 text-sm text-center mt-1">
                                Anda akan mengaktifkan paket Premium.
                            </Text>
                        </View>

                        {/* Order Summary */}
                        <View className="bg-slate-950/50 rounded-xl p-4 mb-6 border border-white/5 space-y-3">
                            <View className="flex-row justify-between">
                                <Text className="text-slate-400">Paket</Text>
                                <Text className="text-white font-bold">{planDetails?.duration}</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-slate-400">Harga Normal</Text>
                                <Text className="text-slate-500 line-through">{formatCurrency(planDetails?.original || 0)}</Text>
                            </View>
                            <View className="h-px bg-white/10 my-1" />
                            <View className="flex-row justify-between items-center">
                                <Text className="text-amber-400 font-bold">Total Bayar</Text>
                                <Text className="text-amber-300 font-extrabold text-xl">{formatCurrency(planDetails?.price || 0)}</Text>
                            </View>
                        </View>

                        {/* Actions */}
                        <TouchableOpacity
                            onPress={confirmPayment}
                            className="w-full bg-amber-500 py-3.5 rounded-xl items-center mb-3 shadow-lg shadow-amber-500/20"
                        >
                            <Text className="text-black font-bold text-lg">Bayar Sekarang</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowModal(false)}
                            className="w-full py-3 items-center"
                        >
                            <Text className="text-slate-400 font-medium">Batalkan</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- BACKGROUND ACCENTS --- */}
            <View className="absolute top-0 left-0 right-0 h-96 opacity-30">
                <LinearGradient colors={['#F59E0B', 'transparent']} style={{ flex: 1 }} />
            </View>

            {/* --- HEADER --- */}
            <View className="px-5 pb-2 flex-row items-center justify-between z-10">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-full">
                    <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-amber-400 font-bold tracking-widest text-xs">PREMIUM ACCESS</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView className="px-5 mt-2" showsVerticalScrollIndicator={false}>

                {/* HERO */}
                <View className="items-center mb-8 mt-4">
                    <View className="bg-amber-500/20 p-4 rounded-full mb-4 border border-amber-500/50 shadow-lg shadow-amber-500/50">
                        <MaterialCommunityIcons name="crown" size={48} color="#fbbf24" />
                    </View>
                    <Text className="text-white text-3xl font-extrabold text-center mb-2">Unlock Full Potential</Text>
                    <Text className="text-slate-400 text-center px-4 leading-5">
                        Dapatkan akses tanpa batas ke sinyal AI, screener canggih, dan data realtime.
                    </Text>
                </View>

                {/* BENEFITS */}
                <View className="bg-slate-900/80 rounded-2xl p-5 mb-8 border border-white/10">
                    <BenefitItem icon="robot-outline" text="Unlimited AI Trading Signals" />
                    <BenefitItem icon="filter-variant" text="Advanced Stock Screener" />
                    <BenefitItem icon="chart-timeline-variant" text="Realtime Magic Chart Pro" />
                    <BenefitItem icon="advertisements-off" text="No Ads (Bebas Iklan)" />
                </View>

                {/* PRICING PLANS */}
                <Text className="text-white font-bold text-lg mb-4">Pilih Paket Langganan</Text>

                <View className="mb-40">
                    {PLANS.map((plan) => {
                        const isSelected = selectedPlan === plan.id;
                        return (
                            <TouchableOpacity
                                key={plan.id}
                                activeOpacity={0.9}
                                onPress={() => setSelectedPlan(plan.id)}
                                className={`flex-row items-center justify-between p-4 mb-6 rounded-2xl border transition-all ${isSelected ? 'bg-amber-500/20 border-amber-400' : 'bg-slate-900/50 border-white/10'}`}
                            >
                                {/* LEFT: Radio & Text */}
                                <View className="flex-row items-center flex-1">
                                    <View className={`w-5 h-5 rounded-full border items-center justify-center mr-3 ${isSelected ? 'border-amber-400' : 'border-slate-600'}`}>
                                        {isSelected && <View className="w-2.5 h-2.5 rounded-full bg-amber-400" />}
                                    </View>

                                    <View>
                                        <Text className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                            {plan.duration}
                                            {plan.save && <Text className="text-emerald-400 text-xs font-bold ml-2"> (Hemat {plan.save})</Text>}
                                        </Text>
                                        {plan.label && (
                                            <Text className="text-amber-500/80 text-xs font-bold uppercase tracking-wider">{plan.label}</Text>
                                        )}
                                    </View>
                                </View>

                                {/* RIGHT: Price */}
                                <View className="items-end">
                                    {plan.original && (
                                        <Text className="text-slate-500 text-xs line-through decorating-slate-500">
                                            {formatCurrency(plan.original)}
                                        </Text>
                                    )}
                                    <Text className={`font-bold text-lg ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                                        {formatCurrency(plan.price)}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* --- STICKY BUTTON --- */}
            <View className="absolute bottom-0 left-0 right-0 p-5 bg-black/90 border-t border-white/10 blur-xl">
                <TouchableOpacity
                    onPress={handleSubscribe}
                    className="w-full bg-amber-500 py-4 rounded-xl items-center shadow-lg shadow-amber-500/20 active:bg-amber-600"
                >
                    <Text className="text-black font-extrabold text-lg uppercase">
                        {selectedPlan === 'trial' ? 'Mulai 7 Hari Gratis' : 'Langganan Sekarang'}
                    </Text>
                    <Text className="text-black/60 text-xs font-bold mt-0.5">
                        {selectedPlan === 'trial' ? 'Batalkan kapan saja' : 'Akses instan ke semua fitur'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

function BenefitItem({ icon, text }: { icon: any, text: string }) {
    return (
        <View className="flex-row items-center mb-3 last:mb-0">
            <View className="bg-amber-500/20 p-1.5 rounded-full mr-3">
                <MaterialCommunityIcons name="check" size={14} color="#fbbf24" />
            </View>
            <Text className="text-slate-300 font-medium">{text}</Text>
        </View>
    );
}
