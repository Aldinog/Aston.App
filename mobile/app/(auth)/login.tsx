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

export default function Login() {
    const router = useRouter();
    const { colorScheme, toggleColorScheme } = useColorScheme();


    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    WebBrowser.maybeCompleteAuthSession();

    async function handleGoogleLogin() {
        Alert.alert("Info Pengembangan", "Fitur Login Google masih dalam tahap pengembangan. Silakan gunakan Email dan Password.");
        /* 
        // Existing implementation commented out for now
        try {
            const redirectUrl = makeRedirectUri({
                scheme: 'astonbot',
                path: 'auth/callback',
            });

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                if (result.type === "success") {
                    console.log("Google Sign-In Result:", result);
                }
            }
        } catch (error: any) {
            Alert.alert("Google Login Error", error.message);
        } 
        */
    }

    async function handleLogin() {
        if (!email || !password) return Alert.alert("Error", "Email dan Password wajib diisi.");

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        setLoading(false);

        if (error) Alert.alert("Login Gagal", error.message);
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
                        className="absolute top-4 right-0 p-3 bg-secondary/50 rounded-full z-50 border border-border"
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
        </KeyboardAvoidingView>
    );
}
