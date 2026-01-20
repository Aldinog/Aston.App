import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface AlertModalProps {
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    onClose: () => void;
}

export default function AlertModal({ visible, type, title, message, onClose }: AlertModalProps) {
    const scaleValue = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.spring(scaleValue, {
                toValue: 1,
                useNativeDriver: true,
                damping: 15,
                stiffness: 150
            }).start();
        } else {
            scaleValue.setValue(0);
        }
    }, [visible]);

    const getIcon = () => {
        switch (type) {
            case 'success': return 'checkmark-circle';
            case 'error': return 'close-circle';
            case 'info': return 'information-circle';
            default: return 'information-circle';
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success': return '#10B981'; // primary
            case 'error': return '#EF4444'; // destructive
            case 'info': return '#3B82F6'; // blue
            default: return '#3B82F6';
        }
    };

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/60 px-6">
                {/* Glassmorphism Background (Optional, requires expo-blur to work well on top of views) */}
                {/* Simplified wrapper to ensure clicks outside don't accidentaly close if strict, 
                     but here we center content. */}

                <Animated.View
                    style={{ transform: [{ scale: scaleValue }] }}
                    className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 items-center shadow-2xl shadow-black/40"
                >
                    <View className="mb-4 bg-background rounded-full p-2 border border-border" style={{ borderColor: getColor() + '40' }}>
                        <Ionicons name={getIcon()} size={50} color={getColor()} />
                    </View>

                    <Text className="text-xl font-bold text-foreground mb-2 text-center">{title}</Text>
                    <Text className="text-muted-foreground text-center mb-6 leading-5">{message}</Text>

                    <TouchableOpacity
                        onPress={onClose}
                        className="w-full py-3 rounded-xl bg-primary items-center active:opacity-90"
                        style={{ backgroundColor: getColor() }}
                    >
                        <Text className="text-white font-bold text-base">OK</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}
