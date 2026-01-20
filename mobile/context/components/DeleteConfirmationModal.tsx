import React from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface DeleteConfirmationModalProps {
    visible: boolean;
    symbol: string | null;
    onClose: () => void;
    onConfirm: () => void;
}

export default function DeleteConfirmationModal({ visible, symbol, onClose, onConfirm }: DeleteConfirmationModalProps) {
    if (!visible) return null;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/60">
                {/* Blur Effect Background */}
                <BlurView intensity={20} tint="dark" style={{ position: 'absolute', width: '100%', height: '100%' }} />

                <View className="w-[85%] bg-[#1E293B] rounded-2xl p-6 border border-white/10 shadow-xl">
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 bg-red-500/10 rounded-full justify-center items-center mb-4">
                            <Ionicons name="trash-outline" size={32} color="#EF4444" />
                        </View>
                        <Text className="text-white text-xl font-bold text-center">Delete {symbol}?</Text>
                        <Text className="text-slate-400 text-center mt-2">
                            This stock will be removed from your watchlist. You can add it back anytime.
                        </Text>
                    </View>

                    <View className="flex-row space-x-3 gap-3">
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 py-3 rounded-xl bg-slate-700 active:bg-slate-600"
                        >
                            <Text className="text-white font-bold text-center">Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onConfirm}
                            className="flex-1 py-3 rounded-xl bg-red-600 active:bg-red-700"
                        >
                            <Text className="text-white font-bold text-center">Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
