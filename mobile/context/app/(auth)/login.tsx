import { View, Text, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from "nativewind";

import AlertModal from '../../components/AlertModal';

export default function Login() {
    const router = useRouter();
    const { colorScheme, toggleColorScheme } = useColorScheme();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
        if (alertConfig.type === 'success' && alertConfig.title === 'Login Berhasil') {
            // Optional: Redirect after success modal closes if not already handled
        }
    };

    WebBrowser.maybeCompleteAuthSession();

    async function handleGoogleLogin() {
        showAlert('info', "Info Pengembangan", "Fitur Login Google masih dalam tahap pengembangan. Silakan gunakan Email dan Password.");
    }

    async function handleLogin() {
        if (!email || !password) return showAlert('error', "Error", "Email dan Password wajib diisi.");

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        setLoading(false);

        if (error) showAlert('error', "Login Gagal", error.message);
        else {
            router.replace('/(tabs)/home');
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className={`flex-1 bg-background ${colorScheme}`}
        >
            <SafeAreaView className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="px-6 relative">
                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

                    {/* Theme Toggle */}
                    <TouchableOpacity
                        onPress={toggleColorScheme}
                        className="absolute top-4 right-0 p-3 bg-secondary/50 rounded-full z-10 border border-border"
                    >
                        <Text className="text-xl">{colorScheme === 'dark' ? '🌙' : '☀️'}</Text>
                    </TouchableOpacity>

                    <View className="items-center mb-12 mt-10">
                        <View className="w-28 h-28 bg-card rounded-3xl justify-center items-center mb-6 border border-border shadow-2xl shadow-primary/10">
                            <Text className="text-5xl">🤖</Text>
                        </View>
                        <Text className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">Aston Trade</Text>
                        <Text className="text-muted-foreground text-base text-center font-medium">Your Personal AI Trading Assistant</Text>
                    </View>

                    <View className="w-full space-y-4">
                        <Input
                            label="Email Address"
                            placeholder="user@example.com"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            className="mb-1"
                        />

                        <Input
                            label="Password"
                            placeholder="••••••••"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            className="mb-1"
                        />

                        <TouchableOpacity className="self-end py-2 mb-6" onPress={() => router.push('/(auth)/forgot-password')}>
                            <Text className="text-primary font-semibold">Forgot Password?</Text>
                        </TouchableOpacity>

                        <Button
                            title="Sign In"
                            onPress={handleLogin}
                            loading={loading}
                            className="mb-6 shadow-xl shadow-primary/20 h-14"
                        />

                        <View className="flex-row items-center mb-6">
                            <View className="flex-1 h-[1px] bg-border" />
                            <Text className="mx-4 text-muted-foreground font-semibold text-xs uppercase tracking-wider">Or continue with</Text>
                            <View className="flex-1 h-[1px] bg-border" />
                        </View>

                        <Button
                            title="Google"
                            variant="secondary"
                            onPress={handleGoogleLogin}
                            className="mb-6 h-14"
                        />
                    </View>

                    <View className="flex-row justify-center mt-auto mb-10 pt-6">
                        <Text className="text-muted-foreground">Don't have an account? </Text>
                        <Link href="/(auth)/register" asChild>
                            <TouchableOpacity>
                                <Text className="text-primary font-bold">Sign Up</Text>
                            </TouchableOpacity>
                        </Link>
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
