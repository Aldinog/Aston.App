import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Dimensions, ActivityIndicator, StatusBar, SafeAreaView, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

const TIMEFRAMES = [
    { label: '15m', value: '15m' },
    { label: 'H1', value: '1h' },
    { label: 'H4', value: '4h' },
    { label: 'D1', value: '1d' },
];

export default function ChartProScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const webViewRef = useRef<WebView>(null);

    // --- STATE ---
    const [symbol, setSymbol] = useState<string>('Loading...');
    const [interval, setInterval] = useState<string>('1d');
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMagicOn, setIsMagicOn] = useState(true);

    // --- INIT ---
    useEffect(() => {
        if (params.symbol) {
            setSymbol((params.symbol as string).replace('.JK', ''));
        } else {
            fetchRandomGainer();
        }
    }, [params.symbol]);

    // --- ACTIONS ---
    const fetchRandomGainer = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const res = await fetch('https://aston-server.vercel.app/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'top-gainers' })
            });
            const json = await res.json();
            if (json.success && json.data && json.data.length > 0) {
                const randomStock = json.data[Math.floor(Math.random() * json.data.length)];
                setSymbol(randomStock.symbol.replace('.JK', ''));
            } else {
                setSymbol('BBCA');
            }
        } catch (e) {
            setSymbol('BBCA');
        } finally {
            // setLoading(false); // don't stop here, let the next fetch handle it or flow through
        }
    };

    const handleSearch = () => {
        if (searchQuery.trim().length > 0) {
            setSymbol(searchQuery.toUpperCase());
            setSearchQuery('');
        }
    };

    // --- CHART HTML GENERATOR ---
    const getChartHtml = () => {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <style>
                body { margin: 0; padding: 0; background-color: #0f172a; overflow: hidden; }
                #chart { width: 100vw; height: 100vh; }
                .loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #64748b; font-family: sans-serif; text-align: center; }
                .retry-btn { margin-top: 10px; padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; }
            </style>
        </head>
        <body>
            <div id="loading" class="loading">
                <span id="status">Initializing Engine...</span>
            </div>
            <div id="chart"></div>
            
            <script>
                // --- DEBUG BRIDGE ---
                function log(msg) {
                    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type: 'LOG', payload: msg}));
                }
                window.onerror = function(message, source, lineno, colno, error) {
                    log('WebView Error: ' + message);
                };

                // --- MULTI-CDN LOADER ---
                const sources = [
                    "https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js",
                    "https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/4.1.1/lightweight-charts.standalone.production.min.js",
                    "https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"
                ];
                let srcIndex = 0;

                function loadLibrary() {
                    if (srcIndex >= sources.length) {
                        log("ALL CDNs FAILED");
                        document.getElementById('status').innerText = "Failed to load Chart Engine.";
                        return;
                    }

                    const url = sources[srcIndex];
                    // log("Attempting to load lib from: " + url);
                    
                    const old = document.getElementById('lw-script');
                    if(old) old.remove();

                    const script = document.createElement('script');
                    script.id = 'lw-script';
                    script.src = url;
                    
                    script.onload = function() {
                        log("Library Loaded");
                        initChart();
                    };

                    script.onerror = function() {
                        log("Failed to load from " + url);
                        srcIndex++;
                        loadLibrary(); 
                    };

                    document.head.appendChild(script);
                }

                loadLibrary();

                // --- CHART LOGIC ---
                let chart;
                let candlestickSeries;
                let markers = [];
                let priceLines = [];
                let pendingData = null;

                function initChart() {
                    const chartDiv = document.getElementById('chart');
                    const loadingDiv = document.getElementById('loading');

                    try {
                        if (!window.LightweightCharts) {
                            return;
                        }

                        chart = LightweightCharts.createChart(chartDiv, {
                            layout: { background: { type: 'solid', color: '#0f172a' }, textColor: '#cbd5e1' },
                            grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
                            width: window.innerWidth,
                            height: window.innerHeight,
                            timeScale: { timeVisible: true, secondsVisible: false },
                        });

                        candlestickSeries = chart.addCandlestickSeries({
                            upColor: '#22c55e', downColor: '#ef4444', borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444'
                        });
                        
                        chart.resize(window.innerWidth, window.innerHeight);
                        
                        // Auto-process pending data
                        if (pendingData) {
                            processData(pendingData);
                            pendingData = null;
                        } else {
                            if(loadingDiv) loadingDiv.innerText = "Waiting for Data...";
                        }
                    } catch(e) {
                        log("Init Error: " + e.message);
                    }
                }

                function processData(payload) {
                    try {
                        const { candles, levels, signals, isMagic } = payload;
                        const loadingDiv = document.getElementById('loading');

                        candlestickSeries.setData(candles);
                        
                        // Clear markers & lines
                        markers = [];
                        priceLines.forEach(l => candlestickSeries.removePriceLine(l));
                        priceLines = [];

                        if (isMagic) {
                            // Markers/Signals
                            if (signals && signals.length > 0) {
                                candlestickSeries.setMarkers(signals.map(s => {
                                    // Robust check for position/type
                                    const type = (s.text || s.position || s.type || 'sell').toLowerCase();
                                    const isBuy = type.includes('buy') || type.includes('below');
                                    return {
                                        time: s.time,
                                        position: isBuy ? 'belowBar' : 'aboveBar',
                                        color: isBuy ? '#22c55e' : '#ef4444',
                                        shape: isBuy ? 'arrowUp' : 'arrowDown',
                                        text: isBuy ? 'BUY' : 'SELL',
                                    };
                                }));
                            }

                            // Levels
                            if (levels && levels.length > 0) {
                                levels.forEach(l => {
                                    const line = candlestickSeries.createPriceLine({
                                        price: l.price,
                                        color: l.type === 'support' ? '#22c55e' : '#ef4444',
                                        lineWidth: 1,
                                        lineStyle: 2, // Dashed
                                        axisLabelVisible: true,
                                        title: l.type.toUpperCase(),
                                    });
                                    priceLines.push(line);
                                });
                            }
                        } else {
                            candlestickSeries.setMarkers([]);
                        }
                        
                        if(loadingDiv) loadingDiv.style.display = 'none';

                        // AUTO ADJUSTMENT:
                        chart.timeScale().fitContent();
                        chart.priceScale('right').applyOptions({
                            autoScale: true,
                            scaleMargins: {
                                top: 0.1,
                                bottom: 0.1,
                            },
                        });

                    } catch(e) {
                        log("Process Data Error: " + e.message);
                    }
                }

                // Bridge to receive data
                function handleEvent(event) {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'UPDATE_DATA') {
                            if (!candlestickSeries) {
                                pendingData = message.payload;
                                return;
                            }
                            processData(message.payload);
                        }
                    } catch(e) {
                        log("Bridge Error: " + e.message);
                    }
                }
                
                document.addEventListener('message', handleEvent);
                window.addEventListener('message', handleEvent);
            </script>
        </body>
        </html>
        `;
    };

    // --- FETCH & INJECT DATA ---
    useEffect(() => {
        if (symbol !== 'Loading...') {
            setLoading(true); // Trigger loading screen
            fetchAndPostData().then(() => {
                setLoading(false); // Stop loading screen once data sent
            });
        }
    }, [symbol, interval, isMagicOn]);

    const fetchAndPostData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch('https://aston-server.vercel.app/api/web', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'chart', symbol: symbol.includes('.') ? symbol : `${symbol}.JK`, interval })
            });

            const json = await res.json();
            if (json.success && json.data) {
                const candles = json.data.candles.map((c: any) => ({
                    time: typeof c.time === 'string' ? new Date(c.time).getTime() / 1000 : c.time,
                    open: c.open,
                    high: c.high,
                    low: c.low,
                    close: c.close
                }));

                candles.sort((a: any, b: any) => a.time - b.time);
                const uniqueCandles = candles.filter((v: any, i: any, a: any) => a.findIndex((t: any) => (t.time === v.time)) === i);

                const payload = {
                    candles: uniqueCandles,
                    levels: json.data.levels || [],
                    signals: json.data.markers || [],
                    isMagic: isMagicOn
                };

                if (webViewRef.current) {
                    webViewRef.current.postMessage(JSON.stringify({ type: 'UPDATE_DATA', payload }));
                }
            }
        } catch (e) {
            console.error("Fetch Error:", e);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-900 pt-12">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* --- HEADER --- */}
            <View className="px-5 pb-2 flex-row items-center z-10 space-x-3">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-white/10 rounded-xl border border-white/5">
                    <Ionicons name="arrow-back" size={20} color="white" />
                </TouchableOpacity>
                <View className="flex-row items-center space-x-3 bg-white/10 rounded-xl px-3 py-2 flex-1 border border-white/5">
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <TextInput
                        placeholder="Search Symbol..."
                        placeholderTextColor="#64748b"
                        className="flex-1 text-white font-bold text-base"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                    />
                </View>
            </View>

            {/* --- SYMBOL --- */}
            <View className="px-6 py-2 pb-2">
                <Text className="text-3xl font-bold text-white tracking-widest">{symbol}</Text>
            </View>

            {/* --- WEBVIEW CHART --- */}
            <View className="flex-1 bg-slate-900 relative">
                <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={{ html: getChartHtml() }}
                    style={{ flex: 1, backgroundColor: '#0f172a' }}
                    containerStyle={{ flex: 1, backgroundColor: '#0f172a' }}
                    scrollEnabled={false}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                />

                {/* --- LOADING OVERLAY --- */}
                {loading && (
                    <View className="absolute inset-0 bg-slate-900/80 justify-center items-center z-20">
                        <ActivityIndicator size="large" color="#34d399" />
                        <Text className="text-white mt-3 font-medium">Analysing Market Data...</Text>
                    </View>
                )}
            </View>

            {/* --- CONTROLS --- */}
            <View className="bg-slate-800/50 rounded-t-3xl p-6 min-h-[160px] border-t border-white/5">
                <View className="flex-row justify-between mb-4 bg-black/20 p-1 rounded-2xl">
                    {TIMEFRAMES.map((tf) => (
                        <TouchableOpacity key={tf.value} onPress={() => setInterval(tf.value)} className={`px-5 py-3 rounded-xl ${interval === tf.value ? 'bg-indigo-600' : 'bg-transparent'}`}>
                            <Text className={`font-bold ${interval === tf.value ? 'text-white' : 'text-slate-400'}`}>{tf.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity onPress={() => setIsMagicOn(!isMagicOn)} className={`flex-row items-center justify-center p-4 rounded-2xl border ${isMagicOn ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800 border-white/10'}`}>
                    <Ionicons name={isMagicOn ? "sparkles" : "sparkles-outline"} size={20} color={isMagicOn ? "#34d399" : "#94a3b8"} />
                    <Text className={`ml-3 font-bold text-lg ${isMagicOn ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isMagicOn ? "AI Indikator Active" : "Enable AI Indikator"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
