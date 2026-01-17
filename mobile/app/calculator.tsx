import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Switch, Alert, StatusBar, SafeAreaView } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

const FEE_REGULAR = { buy: 0.19, sell: 0.29 };
const FEE_PRO = { buy: 0.15, sell: 0.25 }; // Online Trading Murah

export default function CalculatorScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // --- STATE ---
    // Portofolio Awal
    const [p1, setP1] = useState(''); // Harga Modal Awal
    const [l1, setL1] = useState(''); // Lot Dimiliki

    // Simulasi Baru
    const [p2, setP2] = useState(''); // Harga Beli Baru / Pasar
    const [targetMode, setTargetMode] = useState<'LOT' | 'AVG'>('LOT');
    const [l2Input, setL2Input] = useState(''); // Input Lot Tambahan
    const [targetAvgInput, setTargetAvgInput] = useState(''); // Input Target Avg

    // Settings
    const [isProFee, setIsProFee] = useState(false);

    // Results
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        calculate();
    }, [p1, l1, p2, targetMode, l2Input, targetAvgInput, isProFee]);

    // --- LOGIC ---
    const calculate = () => {
        const price1 = parseInt(p1) || 0;
        const lot1 = parseInt(l1) || 0;
        const price2 = parseInt(p2) || 0;

        // Fee
        const fees = isProFee ? FEE_PRO : FEE_REGULAR;

        // Modal Awal
        const modalAwal = price1 * lot1 * 100;
        const marketValue = price2 * lot1 * 100;

        let lot2 = 0;
        let targetAvg = 0;
        let advice = '';

        if (targetMode === 'LOT') {
            lot2 = parseInt(l2Input) || 0;
        } else {
            // Calculate L2 needed to hit Target Avg
            // Avg = (M1 + M2) / (L1 + L2)
            // T = (P1*L1 + P2*L2) / (L1 + L2)
            // T(L1+L2) = P1*L1 + P2*L2
            // T*L1 + T*L2 = P1*L1 + P2*L2
            // T*L2 - P2*L2 = P1*L1 - T*L1
            // L2(T - P2) = L1(P1 - T)
            // L2 = L1(P1 - T) / (T - P2)

            const t = parseInt(targetAvgInput) || 0;
            targetAvg = t;

            if (t > 0 && price2 > 0 && price1 > 0 && lot1 > 0) {
                // Validasi logis
                const minP = Math.min(price1, price2);
                const maxP = Math.max(price1, price2);

                if (t <= minP || t >= maxP) {
                    advice = "⚠️ Target Avg tidak mungkin tercapai (di luar range P1 & P2).";
                } else {
                    const calculatedLot = (lot1 * (price1 - t)) / (t - price2);
                    lot2 = Math.ceil(calculatedLot); // Pembulatan ke atas aman
                    if (lot2 < 0) lot2 = 0; // Just in case
                }
            }
        }

        // Kalkulasi Final
        const modalTambahan = price2 * lot2 * 100;
        const totalModal = modalAwal + modalTambahan;
        const totalLot = lot1 + lot2;
        const avgBaru = totalLot > 0 ? Math.round(totalModal / (totalLot * 100)) : 0;

        // Break Even Point (termasuk fee jual beli)
        // BEP = AvgBaru * (1 + FeeBuy% + FeeSell%) roughly
        const bepRough = Math.round(avgBaru * (1 + (fees.buy / 100) + (fees.sell / 100)));

        setResult({
            modalAwal,
            floatingPL: marketValue - modalAwal,
            floatingPLPercent: modalAwal > 0 ? ((marketValue - modalAwal) / modalAwal) * 100 : 0,
            lot2,
            modalTambahan,
            totalLot,
            totalModal,
            avgBaru,
            bep: bepRough,
            advice
        });
    };

    const getARA_ARB = (price: number) => {
        if (!price) return { ara: 0, arb: 0 };
        let percent = 0;
        // Rules IDX (Approximate)
        if (price < 200) percent = 0.35;
        else if (price <= 5000) percent = 0.25;
        else percent = 0.20;

        // ARB Simetris (Tahap 2 Kebijakan IDX 2023/2024 - Asumsi Simetris)
        // Adjust if needed based on latest rules (currently symmetric again)

        const ara = Math.floor(price * (1 + percent)); // Pembulatan ke bawah sesuai tick biasanya
        const arb = Math.ceil(price * (1 - percent));  // Pembulatan ke atas

        return { ara, arb, percent: percent * 100 };
    };

    const araArb = getARA_ARB(parseInt(p2) || parseInt(p1) || 0);

    const copyToClipboard = async () => {
        if (!result) return;
        const text = `📊 *Trading Plan*
Saham: ${params.symbol || 'XXXX'}
        
📉 *Posisi Awal:*
• Modal: ${l1} lot @ ${p1}
        
🎯 *Action:*
• Beli: ${result.lot2} lot @ ${p2}
• Dana: Rp ${result.modalTambahan.toLocaleString('id-ID')}
        
✅ *Hasil:*
• Avg Baru: ${result.avgBaru}
• Total: ${result.totalLot} lot
• BEP (Est): ${result.bep}
        
Disclaimer on.`;
        await Clipboard.setStringAsync(text);
        Alert.alert("Disalin!", "Trading plan telah disalin ke clipboard.");
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-900 pt-10">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* --- HEADER --- */}
            <View className="px-5 pb-4 flex-row items-center justify-between z-10">
                <View className="flex-row items-center space-x-3">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-xl border border-white/5">
                        <Ionicons name="arrow-back" size={20} color="white" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-white">Kalkulator Saham</Text>
                </View>
                <TouchableOpacity onPress={() => setIsProFee(!isProFee)} className={`flex-row items-center space-x-2 px-3 py-1.5 rounded-full border ${isProFee ? 'bg-indigo-500/20 border-indigo-400' : 'bg-slate-800 border-slate-600'}`}>
                    <MaterialCommunityIcons name="percent" size={14} color={isProFee ? '#818cf8' : '#94a3b8'} />
                    <Text className={`text-xs font-bold ${isProFee ? 'text-indigo-300' : 'text-slate-400'}`}>
                        {isProFee ? 'Pro Fee' : 'Reg Fee'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>

                {/* --- PORTOFOLIO SAAT INI --- */}
                <View className="bg-slate-800/50 rounded-2xl p-5 mb-4 border border-white/5">
                    <Text className="text-emerald-400 font-bold mb-4 flex-row items-center">
                        <Ionicons name="wallet-outline" size={16} /> Portofolio Saat Ini
                    </Text>

                    <View className="flex-row space-x-4">
                        <View className="flex-1">
                            <Text className="text-slate-400 text-xs mb-1">Harga Modal Awal</Text>
                            <TextInput
                                className="bg-slate-900/50 text-white p-3 rounded-xl border border-white/10 font-bold"
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#475569"
                                value={p1}
                                onChangeText={setP1}
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-slate-400 text-xs mb-1">Lot Dimiliki</Text>
                            <TextInput
                                className="bg-slate-900/50 text-white p-3 rounded-xl border border-white/10 font-bold"
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#475569"
                                value={l1}
                                onChangeText={setL1}
                            />
                        </View>
                    </View>
                </View>

                {/* --- SIMULASI --- */}
                <View className="bg-slate-800/50 rounded-2xl p-5 mb-4 border border-white/5">
                    <Text className="text-blue-400 font-bold mb-4 flex-row items-center">
                        <Ionicons name="cart-outline" size={16} /> Simulasi Pembelian (Avg Down/Up)
                    </Text>

                    <View className="mb-4">
                        <Text className="text-slate-400 text-xs mb-1">Harga Beli Baru / Pasar</Text>
                        <TextInput
                            className="bg-slate-900/50 text-white p-3 rounded-xl border border-white/10 font-bold text-lg"
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#475569"
                            value={p2}
                            onChangeText={setP2}
                        />
                        {/* ARA/ARB HELPER */}
                        {(parseInt(p2) > 0 || parseInt(p1) > 0) && (
                            <View className="flex-row justify-between mt-2 px-1">
                                <Text className="text-[10px] text-red-400">ARB: {araArb.arb}</Text>
                                <Text className="text-[10px] text-emerald-400">ARA: {araArb.ara} ({araArb.percent}%)</Text>
                            </View>
                        )}
                    </View>

                    {/* MODE TOGGLE */}
                    <View className="flex-row bg-slate-900/50 p-1 rounded-xl mb-4 border border-white/5">
                        <TouchableOpacity
                            onPress={() => setTargetMode('LOT')}
                            className={`flex-1 py-2 rounded-lg items-center ${targetMode === 'LOT' ? 'bg-slate-700' : 'bg-transparent'}`}
                        >
                            <Text className={`font-bold text-xs ${targetMode === 'LOT' ? 'text-white' : 'text-slate-500'}`}>Input Lot</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setTargetMode('AVG')}
                            className={`flex-1 py-2 rounded-lg items-center ${targetMode === 'AVG' ? 'bg-slate-700' : 'bg-transparent'}`}
                        >
                            <Text className={`font-bold text-xs ${targetMode === 'AVG' ? 'text-white' : 'text-slate-500'}`}>Target Avg</Text>
                        </TouchableOpacity>
                    </View>

                    <View>
                        {targetMode === 'LOT' ? (
                            <>
                                <Text className="text-slate-400 text-xs mb-1">Input Lot Tambahan</Text>
                                <TextInput
                                    className="bg-slate-900/50 text-white p-3 rounded-xl border border-white/10 font-bold"
                                    keyboardType="numeric"
                                    placeholder="Mau beli berapa lot?"
                                    placeholderTextColor="#475569"
                                    value={l2Input}
                                    onChangeText={setL2Input}
                                    autoFocus={true}
                                />
                            </>
                        ) : (
                            <>
                                <Text className="text-slate-400 text-xs mb-1">Target Harga Average</Text>
                                <TextInput
                                    className="bg-slate-900/50 text-white p-3 rounded-xl border border-white/10 font-bold text-amber-400"
                                    keyboardType="numeric"
                                    placeholder="Ingin avg jadi berapa?"
                                    placeholderTextColor="#475569"
                                    value={targetAvgInput}
                                    onChangeText={setTargetAvgInput}
                                    autoFocus={true}
                                />
                                {result?.advice ? (
                                    <Text className="text-amber-400/80 text-xs mt-2 italic">{result.advice}</Text>
                                ) : null}
                            </>
                        )}
                    </View>
                </View>

                {/* --- HASIL --- */}
                {result && (
                    <View className="bg-indigo-900/20 rounded-2xl p-5 mb-20 border border-indigo-500/30">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-indigo-300 font-bold text-lg">Hasil Estimasi</Text>
                            <TouchableOpacity onPress={copyToClipboard} className="bg-indigo-500/20 p-2 rounded-lg">
                                <Ionicons name="copy-outline" size={16} color="#818cf8" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row justify-between mb-3 border-b border-indigo-500/10 pb-3">
                            <Text className="text-slate-400">Total Lot Akhir</Text>
                            <Text className="text-white font-bold">{result.totalLot} lot <Text className="text-emerald-400 text-xs">(+{result.lot2})</Text></Text>
                        </View>

                        <View className="flex-row justify-between mb-3 border-b border-indigo-500/10 pb-3">
                            <Text className="text-slate-400">Avg Price Baru</Text>
                            <Text className="text-white font-bold text-xl">{result.avgBaru}</Text>
                        </View>

                        <View className="flex-row justify-between mb-3 border-b border-indigo-500/10 pb-3">
                            <Text className="text-slate-400">Est. Modal Tambahan</Text>
                            <Text className="text-amber-400 font-bold">{formatCurrency(result.modalTambahan)}</Text>
                        </View>

                        <View className="flex-row justify-between mb-3">
                            <Text className="text-slate-400">Est. Break Even (Fee)</Text>
                            <Text className="text-slate-300 font-bold">{result.bep}</Text>
                        </View>

                        <View className="mt-2 p-3 bg-black/20 rounded-lg">
                            <Text className="text-slate-400 text-xs mb-1">Floating P/L (Dgn Harga Beli Baru)</Text>
                            <Text className={`font-bold ${result.floatingPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {result.floatingPL >= 0 ? '+' : ''}{formatCurrency(result.floatingPL)} ({result.floatingPLPercent.toFixed(2)}%)
                            </Text>
                        </View>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}
