import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';

const TRENDING_DATA = [
    { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia', price: '72', change: '+3.4%', isUp: true },
    { symbol: 'ANTM', name: 'Aneka Tambang Tbk', price: '1,650', change: '-1.2%', isUp: false },
    { symbol: 'TLKM', name: 'Telkom Indonesia', price: '3,210', change: '+0.8%', isUp: true },
    { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', price: '4,850', change: '-0.5%', isUp: false },
    { symbol: 'ASII', name: 'Astra International', price: '5,100', change: '+1.5%', isUp: true },
];

export default function TrendingList() {
    return (
        <View className="px-6 pb-6">
            <View className="flex-col">
                {TRENDING_DATA.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        activeOpacity={0.7}
                        className="flex-row justify-between items-center py-4 border-b border-border/40"
                    >
                        {/* Left: Icon & Name */}
                        <View className="flex-row items-center flex-1">
                            <View className="w-10 h-10 bg-muted/20 rounded-full justify-center items-center mr-3">
                                <Text className="font-bold text-xs">{item.symbol[0]}</Text>
                            </View>
                            <View>
                                <Text className="text-foreground font-bold text-base">{item.symbol}</Text>
                                <Text className="text-muted-foreground text-xs" numberOfLines={1}>{item.name}</Text>
                            </View>
                        </View>

                        {/* Right: Chart (Mini) & Price */}
                        <View className="items-end">
                            <Text className="text-foreground font-bold text-base">{item.price}</Text>
                            <View className={`px-2 py-0.5 rounded-md ${item.isUp ? 'bg-green-500/10' : 'bg-red-500/10'} mt-1`}>
                                <Text className={`text-xs font-bold ${item.isUp ? 'text-green-500' : 'text-red-500'}`}>
                                    {item.change}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
