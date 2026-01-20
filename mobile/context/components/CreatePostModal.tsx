import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Image, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';

interface CreatePostModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    userId?: string;
}

export default function CreatePostModal({ visible, onClose, onSuccess, userId }: CreatePostModalProps) {
    const [content, setContent] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [sentiment, setSentiment] = useState<'BULLISH' | 'BEARISH' | null>(null);
    const [loading, setLoading] = useState(false);

    // Anti-Spam / Content Filter
    const validateContent = (text: string) => {
        const lower = text.toLowerCase();

        // 1. Block Group Links
        const linkPatterns = [
            /t\.me\//,
            /wa\.me\//,
            /chat\.whatsapp\.com/,
            /bit\.ly\//,
            /instagram\.com\/join/,
        ];
        if (linkPatterns.some(pattern => pattern.test(lower))) {
            Alert.alert("Spam Detected", "Posting links to groups or external chats is not allowed.");
            return false;
        }

        // 2. Block Keywords
        const blacklisted = [
            "titip dana", "garansi profit", "join grup", "pasti cuan", "modal kecil",
            "joki saham", "jasa joki", "investasi bodong"
        ];
        if (blacklisted.some(word => lower.includes(word))) {
            Alert.alert("Warning", "Your post contains restricted keywords related to scams.");
            return false;
        }

        return true;
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5, // Compress logic client-side
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            setImage(result.assets[0].uri);
            setImageBase64(result.assets[0].base64);
        }
    };

    const handlePost = async () => {
        if (!content.trim()) return;
        if (!validateContent(content)) return;

        setLoading(true);
        try {
            let finalImageUrl = null;

            // 1. Upload Image if exists
            if (imageBase64) {
                const fileName = `${userId}/${Date.now()}.jpg`;

                const { data, error: uploadError } = await supabase.storage
                    .from('discussion-images')
                    .upload(fileName, decode(imageBase64), {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data: publicUrlData } = supabase.storage
                    .from('discussion-images')
                    .getPublicUrl(fileName);

                finalImageUrl = publicUrlData.publicUrl;
            }

            // 2. Extract Cashtags (e.g. $BBCA)
            const cashtags = content.match(/\$[A-Za-z]+/g)?.map(t => t.toUpperCase().replace('$', '')) || [];

            // 3. Insert Post
            const { error: insertError } = await supabase
                .from('posts')
                .insert({
                    user_id: userId,
                    content: content.trim(),
                    image_url: finalImageUrl,
                    cashtags: cashtags.length > 0 ? cashtags : null,
                    sentiment: sentiment
                });

            if (insertError) throw insertError;

            // 4. Success
            setContent('');
            setImage(null);
            setImageBase64(null);
            setSentiment(null);
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error('Post Error:', error);
            Alert.alert("Error", "Failed to create post. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-[#1E293B] rounded-t-3xl h-[85%] border-t border-white/10">
                    {/* Header */}
                    <View className="flex-row justify-between items-center px-5 py-4 border-b border-white/5">
                        <TouchableOpacity onPress={onClose}>
                            <Text className="text-slate-400 text-base">Cancel</Text>
                        </TouchableOpacity>
                        <Text className="text-white font-bold text-lg">New Post</Text>
                        <TouchableOpacity
                            onPress={handlePost}
                            disabled={loading || !content.trim()}
                            className={`px-4 py-1.5 rounded-full ${loading || !content.trim() ? 'bg-slate-700' : 'bg-primary'}`}
                        >
                            {loading ? <ActivityIndicator size="small" color="white" /> : (
                                <Text className="text-white font-bold text-sm">Post</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 px-5 pt-4">
                        {/* Text Input */}
                        <TextInput
                            multiline
                            placeholder="What's happening in the market? Use $SYMBOL to tag stocks."
                            placeholderTextColor="#64748B"
                            className="text-white text-base leading-6 min-h-[100px]"
                            value={content}
                            onChangeText={setContent}
                            textAlignVertical="top"
                            autoFocus
                        />

                        {/* Image Preview */}
                        {image && (
                            <View className="relative mt-4 mb-2">
                                <Image source={{ uri: image }} className="w-full h-48 rounded-xl bg-slate-800" resizeMode="cover" />
                                <TouchableOpacity
                                    onPress={() => { setImage(null); setImageBase64(null); }}
                                    className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full justify-center items-center"
                                >
                                    <Ionicons name="close" size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    {/* Toolbar */}
                    <View className="px-5 py-4 border-t border-white/5 bg-slate-900/50 pb-8">
                        {/* Sentiment Selector */}
                        <View className="flex-row items-center mb-4 space-x-3 gap-3">
                            <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">Sentiment</Text>

                            <TouchableOpacity
                                onPress={() => setSentiment(sentiment === 'BULLISH' ? null : 'BULLISH')}
                                className={`flex-row items-center px-3 py-1.5 rounded-full border ${sentiment === 'BULLISH' ? 'bg-green-500/20 border-green-500' : 'border-slate-700 bg-slate-800'
                                    }`}
                            >
                                <Ionicons name="arrow-up" size={12} color={sentiment === 'BULLISH' ? '#4ADE80' : '#64748B'} />
                                <Text className={`ml-1 text-xs font-bold ${sentiment === 'BULLISH' ? 'text-green-400' : 'text-slate-400'}`}>Bullish</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSentiment(sentiment === 'BEARISH' ? null : 'BEARISH')}
                                className={`flex-row items-center px-3 py-1.5 rounded-full border ${sentiment === 'BEARISH' ? 'bg-red-500/20 border-red-500' : 'border-slate-700 bg-slate-800'
                                    }`}
                            >
                                <Ionicons name="arrow-down" size={12} color={sentiment === 'BEARISH' ? '#F87171' : '#64748B'} />
                                <Text className={`ml-1 text-xs font-bold ${sentiment === 'BEARISH' ? 'text-red-400' : 'text-slate-400'}`}>Bearish</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row items-center justify-between">
                            <TouchableOpacity onPress={pickImage} className="w-10 h-10 bg-slate-800 rounded-full justify-center items-center active:bg-slate-700">
                                <Ionicons name="image-outline" size={22} color="#10B981" />
                            </TouchableOpacity>
                            <Text className="text-slate-500 text-xs">
                                {content.length}/500
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
