import { View, Text, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from "nativewind";

export default function Register() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!email || !password || !confirmPassword) return Alert.alert("Error", "Semua kolom wajib diisi.");
        if (password !== confirmPassword) return Alert.alert("Error", "Password tidak cocok.");

        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        setLoading(false);

        if (error) Alert.alert("Pendaftaran Gagal", error.message);
        else {
            Alert.alert("Sukses", "Cek email Anda untuk verifikasi!", [
                { text: "OK", onPress: () => router.back() }
            ]);
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className={`flex-1 bg-background ${colorScheme}`}>
            <SafeAreaView className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="px-6">
                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

                    <View className="mb-10 mt-4">
                        <Text className="text-4xl font-extrabold text-foreground mb-2 tracking-tight">Buat Akun</Text>
                        <Text className="text-muted-foreground text-lg font-medium">Bergabung dengan komunitas trader cerdas.</Text>
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
                            placeholder="Min. 6 karakter"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            className="mb-1"
                        />

                        <Input
                            label="Ulangi Password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            className="mb-6"
                        />

                        <Button
                            title="Daftar Sekarang"
                            onPress={handleRegister}
                            loading={loading}
                            className="mb-6 shadow-xl shadow-primary/20 h-14"
                        />

                        <View className="flex-row justify-center mt-4">
                            <Text className="text-muted-foreground">Sudah punya akun? </Text>
                            <TouchableOpacity onPress={() => router.back()}>
                                <Text className="text-primary font-bold">Masuk</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
