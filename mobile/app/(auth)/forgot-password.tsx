import { View, Text, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from "nativewind";

export default function ForgotPassword() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleResetPassword() {
        if (!email) return Alert.alert("Error", "Email wajib diisi.");

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://example.com/update-password', // Nanti sesuaikan dengan deep link app
        });
        setLoading(false);

        if (error) Alert.alert("Gagal", error.message);
        else {
            Alert.alert("Sukses", "Link reset password telah dikirim ke email Anda.");
            router.back();
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
        </KeyboardAvoidingView>
    );
}
