import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface UsernameSetupModalProps {
    visible: boolean;
    userId: string;
    onSuccess: (username: string) => void;
}

export default function UsernameSetupModal({ visible, userId, onSuccess }: UsernameSetupModalProps) {
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError('Only letters, numbers, and underscores allowed');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Check Uniqueness
            const { data: existing, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .maybeSingle();

            if (checkError) throw checkError;
            if (existing) {
                setError('Username already taken');
                setLoading(false);
                return;
            }

            // 2. Upsert User Profile (Update if exists, Insert if missing)
            // This prevents FK errors if the user row is missing in public.users
            const { error: updateError } = await supabase
                .from('users')
                .upsert({ id: userId, username: username });

            if (updateError) throw updateError;

            // Success
            onSuccess(username);

        } catch (err: any) {
            console.error('Username Setup Error:', err);
            setError(err.message || 'Failed to update username');
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal animationType="fade" transparent={true} visible={visible}>
            <View className="flex-1 justify-center items-center bg-black/80">
                <BlurView intensity={20} tint="dark" style={{ position: 'absolute', width: '100%', height: '100%' }} />

                <View className="w-[85%] bg-[#1E293B] rounded-2xl p-6 border border-white/10 shadow-xl">
                    <View className="items-center mb-6">
                        <View className="w-16 h-16 bg-primary/20 rounded-full justify-center items-center mb-4">
                            <Ionicons name="person-add" size={32} color="#10B981" />
                        </View>
                        <Text className="text-white text-xl font-bold text-center">Create Username</Text>
                        <Text className="text-slate-400 text-center mt-2 text-sm">
                            Choose a unique username to join the discussion. You cannot change this later.
                        </Text>
                    </View>

                    <View className="mb-4">
                        <Text className="text-slate-400 text-xs mb-2 ml-1">USERNAME</Text>
                        <View className="flex-row items-center bg-slate-800 rounded-xl px-4 border border-slate-700">
                            <Text className="text-slate-400 mr-1">@</Text>
                            <TextInput
                                className="flex-1 text-white py-3 font-semibold"
                                placeholder="astonmology"
                                placeholderTextColor="#64748B"
                                value={username}
                                onChangeText={(t) => {
                                    setUsername(t.toLowerCase());
                                    setError(null);
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                        {error && (
                            <Text className="text-red-500 text-xs mt-2 ml-1">{error}</Text>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading || !username}
                        className={`py-3.5 rounded-xl ${loading || !username ? 'bg-slate-700' : 'bg-primary'} items-center`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold">Join Community</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
