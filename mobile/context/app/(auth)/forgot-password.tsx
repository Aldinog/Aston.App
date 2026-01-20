import { View, Text, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from "nativewind";

import AlertModal from '../../components/AlertModal';

export default function ForgotPassword() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    // Alert State
    const [alertConfig, setAlertConfig] = useState<{ visible: boolean, type: 'success' | 'error' | 'info', title: string, message: string }>({
        visible: false,
        type: 'info',
        title: '',
        message: ''
    });

    const showAlert = (type: 'success' | 'error' | 'info', title: string, message: string) => {
        setAlertConfig({ visible: true, type, title, message });
    };

    const hideAlert = () => {
        setAlertConfig({ ...alertConfig, visible: false });
        if (alertConfig.type === 'success') {
            router.back();
        }
    };

    async function handleResetPassword() {
        if (!email) return showAlert('error', "Error", "Email wajib diisi.");

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://aston-server.vercel.app/api/auth/callback', // Updated to Proxy URL
        });
        setLoading(false);

        if (error) showAlert('error', "Gagal", error.message);
        else {
            showAlert('success', "Sukses", "Link reset password telah dikirim ke email Anda.");
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className={`flex-1 bg-background ${colorScheme}`}>
            <SafeAreaView className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="px-6">
                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

                    <TouchableOpacity onPress={() => router.back()} className="absolute top-12 left-6 z-10">
                        <Text className="text-primary text-lg font-bold">← Back</Text>
                    </TouchableOpacity>

                    <View className="items-center mb-8 mt-10">
                        <View className="w-20 h-20 bg-card rounded-2xl justify-center items-center mb-4 border border-border shadow-lg">
                            <Text className="text-4xl">🔐</Text>
                        </View>
                        <Text className="text-2xl font-bold text-foreground mb-2">Forgot Password</Text>
                        <Text className="text-muted-foreground text-center">Enter your email to receive a reset link.</Text>
                    </View>

                    <View className="w-full space-y-4">
                        <Input
                            label="Email Address"
                            placeholder="user@example.com"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            className="mb-4"
                        />

                        <Button
                            title="Send Reset Link"
                            onPress={handleResetPassword}
                            loading={loading}
                            className="mb-6 h-14"
                        />
                    </View>
                </ScrollView>
            </SafeAreaView>

            <AlertModal
                visible={alertConfig.visible}
                type={alertConfig.type}
                title={alertConfig.title}
                message={alertConfig.message}
                onClose={hideAlert}
            />
        </KeyboardAvoidingView>
    );
}
