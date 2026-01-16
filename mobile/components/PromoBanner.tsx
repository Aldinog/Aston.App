import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Dimensions, FlatList, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useColorScheme } from 'nativewind';

const { width } = Dimensions.get('window');
const BANNER_ASPECT_RATIO = 16 / 9; // Standard promo ratio
const BANNER_HEIGHT = width / BANNER_ASPECT_RATIO;

// Placeholder Data - Nanti bisa diganti API
const PROMO_DATA = [
    {
        id: '1',
        title: 'Premium Trading',
        imageUrl: 'https://picsum.photos/800/450?random=1', // Placeholder Professional
        link: 'https://aston.trade/premium',
        type: 'image'
    },
    {
        id: '2',
        title: 'Learn Crypto',
        imageUrl: 'https://picsum.photos/800/450?random=2',
        link: 'https://aston.trade/learn',
        type: 'image'
    },
    {
        id: '3',
        title: 'Market Outlook',
        imageUrl: 'https://picsum.photos/800/450?random=3',
        link: 'https://aston.trade/news',
        type: 'image'
    }
];

export default function PromoBanner() {
    const { colorScheme } = useColorScheme();
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // Auto Slide Logic
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeIndex === PROMO_DATA.length - 1) {
                flatListRef.current?.scrollToIndex({ index: 0, animated: true });
                setActiveIndex(0);
            } else {
                flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
                setActiveIndex(activeIndex + 1);
            }
        }, 5000); // 5 Detik

        return () => clearInterval(interval);
    }, [activeIndex]);

    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / width);
        setActiveIndex(index);
    };

    const handlePress = (item: any) => {
        // Nanti bisa deteksi tipe disini (Video/Image)
        if (item.link) {
            Linking.openURL(item.link).catch(err => console.error("Couldn't load page", err));
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handlePress(item)}
                style={{ width: width, paddingHorizontal: 20 }} // Padding container
            >
                <View className="rounded-2xl overflow-hidden shadow-lg bg-card border border-border">
                    <Image
                        source={{ uri: item.imageUrl }}
                        style={{ width: '100%', height: 180, resizeMode: 'cover' }}
                    />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="mb-6 mt-4">
            <FlatList
                ref={flatListRef}
                data={PROMO_DATA}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                snapToInterval={width} // Snap per layar
                decelerationRate="fast"
            />

            {/* Dots Indicator */}
            <View className="flex-row justify-center mt-3 space-x-2">
                {PROMO_DATA.map((_, index) => (
                    <View
                        key={index}
                        className={`h-2 rounded-full transition-all duration-300 ${index === activeIndex
                                ? 'w-6 bg-primary'
                                : 'w-2 bg-muted-foreground/30'
                            }`}
                    />
                ))}
            </View>
        </View>
    );
}
