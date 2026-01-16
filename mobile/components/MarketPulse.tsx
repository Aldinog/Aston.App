import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const INDICES = [
    { label: 'IHSG', symbol: '^JKSE' },
    { label: 'LQ45', symbol: '^JKLQ45' },
    { label: 'USD/IDR', symbol: 'USDIDR=X' },
    { label: 'BTC/USD', symbol: 'BTC-USD' },
    { label: 'GOLD', symbol: 'GC=F' },
];

export default function MarketPulse() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        fetchMarketData();
    }, []);

    const fetchMarketData = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                setErrorMsg("No Auth Token (Login first)");
                return;
            }

            const symbols = INDICES.map(i => i.symbol).join(',');
            const apiUrl = process.env.EXPO_PUBLIC_API_URL;

            // Debug log
            console.log(`Fetching ${apiUrl}/api/web...`);

            const response = await fetch(`${apiUrl}/api/web`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'quote',
                    symbol: symbols
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server Error: ${response.status} - ${text.substring(0, 30)}...`);
            }

            const result = await response.json();
            if (result.success && result.data) {
                const mappedData = INDICES.map(idx => {
                    const quote = result.data.find((q: any) => q.symbol === idx.symbol) || {};
                    return {
                        symbol: idx.label,
                        price: formatPrice(idx.symbol, quote.regularMarketPrice),
                        change: formatChange(quote.regularMarketChangePercent),
                        isUp: (quote.regularMarketChangePercent || 0) >= 0
                    };
                });
                setData(mappedData);
            } else {
                throw new Error(result.error || "Data kosong/gagal");
            }
        } catch (error: any) {
            console.error("Failed to fetch market data:", error);
            const msg = error.message || "Network Error";
            // Simplify Network Error for user
            if (msg.includes('Network request failed')) {
                setErrorMsg("Koneksi gagal. Cek backend server.");
            } else {
                setErrorMsg(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (symbol: string, price: number) => {
        if (!price) return '-';
        if (symbol === 'USDIDR=X') return `Rp${price.toLocaleString('id-ID')}`;
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatChange = (change: number) => {
        if (change === undefined || change === null) return '0.00%';
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    };

    if (loading) {
        return (
            <View className="mb-6 h-20 justify-center items-center">
                <ActivityIndicator size="small" />
                <Text className="text-muted-foreground text-xs mt-2">Loading Market Data...</Text>
            </View>
        );
    }

    if (!data || data.length === 0 || errorMsg) {
        return (
            <View className="mb-6 mx-6 p-4 bg-card rounded-xl border border-destructive/50 justify-center items-center">
                <Text className="text-muted-foreground text-xs mb-1 font-semibold">Gagal memuat data pasar</Text>
                <Text className="text-destructive text-[10px] text-center mb-3 px-2">{errorMsg}</Text>
                <Text
                    className="text-primary font-bold text-xs py-2 px-4 bg-primary/10 rounded-lg overflow-hidden"
                    onPress={fetchMarketData}
                >
                    Coba Lagi ↻
                </Text>
            </View>
        );
    }

    return (
        <View className="mb-6">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {data.map((item, index) => (
                    <View
                        key={index}
                        className="bg-card mr-3 px-4 py-3 rounded-xl border border-border shadow-sm items-center min-w-[100px]"
                    >
                        <Text className="text-muted-foreground text-xs font-bold mb-1">{item.symbol}</Text>
                        <Text className="text-foreground text-sm font-bold mb-1">{item.price}</Text>
                        <Text className={`text-xs font-semibold ${item.isUp ? 'text-green-500' : 'text-red-500'}`}>
                            {item.change}
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
