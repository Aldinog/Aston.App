import { View, Text, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from "nativewind";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';

import AlertModal from '../../components/AlertModal';

export default function Register() {
    const router = useRouter();
    const { colorScheme } = useColorScheme();

    // Form State
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Avatar State
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [avatarBase64, setAvatarBase64] = useState<string | null>(null);

    // UI State
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
            router.back(); // Redirect to login on success
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            setAvatarUri(result.assets[0].uri);
            setAvatarBase64(result.assets[0].base64);
        }
    };

    const uploadAvatar = async (userId: string) => {
        if (!avatarBase64) return null;
        try {
            const fileName = `${userId}/${Date.now()}.jpg`;
            const { data, error } = await supabase.storage
                .from('discussion-images')
                .upload(fileName, decode(avatarBase64), {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) throw error;

            const { data: publicData } = supabase.storage
                .from('discussion-images')
                .getPublicUrl(fileName);

            return publicData.publicUrl;
        } catch (e) {
            console.error("Avatar upload failed:", e);
            return null;
        }
    }

    async function handleRegister() {
        if (!username || !email || !password || !confirmPassword) return showAlert('error', "Error", "Semua kolom wajib diisi.");
        if (password !== confirmPassword) return showAlert('error', "Error", "Password tidak cocok.");
        if (username.length < 3) return showAlert('error', "Error", "Username minimal 3 karakter.");
        if (username.includes(' ')) return showAlert('error', "Error", "Username tidak boleh ada spasi.");

        setLoading(true);

        try {
            const { data: { session, user }, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: 'https://aston-server.vercel.app/api/auth/callback', // Force redirect to our Proxy
                    data: {
                        username: username.toLowerCase(),
                        full_name: username,
                    }
                }
            });

            if (error) throw error;
            if (!user) throw new Error("Registrasi gagal. Coba lagi.");

            // 2. Upload Avatar & Update Profile (if avatar selected)
            if (avatarBase64 && user.id) {
                const publicAvatarUrl = await uploadAvatar(user.id);
                if (publicAvatarUrl) {
                    await supabase
                        .from('users')
                        .update({ avatar_url: publicAvatarUrl })
                        .eq('id', user.id);
                }
            }

            showAlert('success', "Sukses", "Akun berhasil dibuat! Cek email untuk verifikasi.");

        } catch (error: any) {
            showAlert('error', "Pendaftaran Gagal", error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className={`flex-1 bg-background ${colorScheme}`}>
            <SafeAreaView className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="px-6">
                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

                    <View className="mb-8 mt-4 items-center">
                        <Text className="text-3xl font-extrabold text-foreground mb-2 tracking-tight text-center">Buat Identitas</Text>
                        <Text className="text-muted-foreground text-base text-center mb-6">Profil unik untuk komunitas trader.</Text>

                        {/* Avatar Picker */}
                        <TouchableOpacity onPress={pickImage} className="relative">
                            <View className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-600 justify-center items-center overflow-hidden">
                                {avatarUri ? (
                                    <Image source={{ uri: avatarUri }} className="w-full h-full" />
                                ) : (
                                    <Ionicons name="camera-outline" size={32} color="#94a3b8" />
                                )}
                            </View>
                            <View className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 border border-background">
                                <Ionicons name="add" size={16} color="white" />
                            </View>
                        </TouchableOpacity>
                        <Text className="text-xs text-muted-foreground mt-2">{avatarUri ? "Ganti Foto" : "Upload Foto (Opt)"}</Text>
                    </View>

                    <View className="w-full space-y-4">
                        <Input
                            label="Username"
                            placeholder="Username"
                            value={username}
                            onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                            autoCapitalize="none"
                            className="mb-1"
                            icon={<Ionicons name="at" size={20} color="gray" />}
                        />

                        <Input
                            label="Email Address"
                            placeholder="user@example.com"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            className="mb-1"
                            icon={<Ionicons name="mail-outline" size={20} color="gray" />}
                        />

                        <Input
                            label="Password"
                            placeholder="Min. 6 karakter"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            className="mb-1"
                            icon={<Ionicons name="lock-closed-outline" size={20} color="gray" />}
                        />

                        <Input
                            label="Ulangi Password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            className="mb-6"
                            icon={<Ionicons name="lock-closed-outline" size={20} color="gray" />}
                        />

                        <Button
                            title={loading ? "Mendaftarkan..." : "Daftar Sekarang"}
                            onPress={handleRegister}
                            loading={loading}
                            className="mb-6 shadow-xl shadow-primary/20 h-14"
                        />

                        <View className="flex-row justify-center mt-4 pb-10">
                            <Text className="text-muted-foreground">Sudah punya akun? </Text>
                            <TouchableOpacity onPress={() => router.back()}>
                                <Text className="text-primary font-bold">Masuk</Text>
                            </TouchableOpacity>
                        </View>
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
