import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, RefreshControl, FlatList, Alert, Platform, StatusBar, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import UsernameSetupModal from '../../components/UsernameSetupModal';
import CreatePostModal from '../../components/CreatePostModal';
import PostCard from '../../components/PostCard';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const USERNAME_CACHE_KEY = 'discussion_username';

export default function Discussion() {
    const { colorScheme } = useColorScheme();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Feed State
    const [posts, setPosts] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Initial Auth & Profile Check
    const checkProfile = async () => {
        try {
            // 1. Get Session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            setUser(session.user);

            // TEMP: Force Clear Cache to fix "@aston" issue
            await AsyncStorage.removeItem(USERNAME_CACHE_KEY);

            // 2. Fetch Fresh Profile (Username) from DB
            const { data: profile, error } = await supabase
                .from('users')
                .select('username')
                .eq('id', session.user.id)
                .single();

            if (!error && profile && profile.username) {
                // Found in DB -> Update State & Cache
                setUsername(profile.username);
                await AsyncStorage.setItem(USERNAME_CACHE_KEY, profile.username);
            } else {
                // Not found or error -> Try Cache as backup
                const cachedUsername = await AsyncStorage.getItem(USERNAME_CACHE_KEY);
                if (cachedUsername) {
                    setUsername(cachedUsername);
                } else {
                    // No username anywhere -> Modal
                    setShowUsernameModal(true);
                }
            }
        } catch (e) {
            console.error('Profile Check Error:', e);
        } finally {
            setLoading(false);
        }
    };

    // Load Posts
    const fetchPosts = async () => {
        try {
            const { data, error } = await supabase
                .from('posts')
                .select(`
                    *,
                    user:users!posts_user_id_fkey(username, avatar_url)
                `)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setPosts(data || []);
        } catch (error) {
            console.error('Fetch Posts Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            checkProfile();
            fetchPosts();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPosts();
    }, []);

    // Default Avatar Asset
    const defaultAvatar = require('../../assets/default-avatar.jpg');

    const handleUsernameSuccess = async (newUsername: string) => {
        setUsername(newUsername);
        setShowUsernameModal(false);
        // Persist locally
        await AsyncStorage.setItem(USERNAME_CACHE_KEY, newUsername);
    };

    const handlePostSuccess = () => {
        fetchPosts(); // Reload feed
        // Scroll to top logic if ref existed
    };

    // Placeholder Actions
    const handleLike = async (postId: string) => {
        // Basic Optimistic UI for like could be added here
        Alert.alert("Info", "Like feature coming next!");
    };

    const handleComment = (postId: string) => {
        Alert.alert("Info", "Comments coming soon!");
    };

    const handleReport = (postId: string) => {
        Alert.alert("Report", "Thanks. We will review this post.");
    };

    // Feed Placeholder
    const renderFeed = () => {
        if (loading && posts.length === 0) {
            return (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#10B981" />
                </View>
            );
        }

        if (posts.length === 0) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <View className="w-20 h-20 bg-slate-800 rounded-full justify-center items-center mb-6 overflow-hidden">
                        {/* Fallback to Default Avatar if no user avatar (though this is placeholder, good to be consistent) */}
                        <Image source={defaultAvatar} className="w-full h-full" />
                    </View>
                    <Text className="text-white text-xl font-bold text-center">Hello, @{username}!</Text>
                    <Text className="text-slate-400 text-center mt-2 leading-6">
                        The discussion feed is currently empty. Be the first to start a conversation about market trends!
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowCreateModal(true)}
                        className="mt-8 bg-primary px-6 py-3 rounded-full flex-row items-center space-x-2 gap-2"
                    >
                        <Ionicons name="create-outline" size={20} color="white" />
                        <Text className="text-white font-bold">Write a Post</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        onLike={handleLike}
                        onComment={handleComment}
                        onUserPress={(u) => console.log('User:', u)}
                        onReport={handleReport}
                    />
                )}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
                }
            />
        );
    };



    return (
        <SafeAreaView className={`flex-1 bg-background ${colorScheme}`} style={{ paddingTop: Platform.OS === 'android' ? 35 : 0 }}>
            {/* Header */}
            <View className="px-5 py-4 border-b border-white/5 flex-row justify-between items-center bg-background/80 blur-md z-10">
                <Text className="text-foreground font-black text-2xl tracking-tight">Discussion 💬</Text>

                {/* Header Actions */}
                <View className="flex-row items-center gap-3 space-x-3">
                    {/* Create Post Button (Header) */}
                    <TouchableOpacity
                        onPress={() => setShowCreateModal(true)}
                        className="w-9 h-9 bg-primary/20 rounded-full justify-center items-center"
                    >
                        <Ionicons name="add" size={24} color="#10B981" />
                    </TouchableOpacity>

                    {username && (
                        <TouchableOpacity className="w-9 h-9 bg-slate-800 rounded-full justify-center items-center">
                            <Ionicons name="notifications-outline" size={20} color="white" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {renderFeed()}

            {/* Modals */}
            {user && (
                <UsernameSetupModal
                    visible={showUsernameModal}
                    userId={user.id}
                    onSuccess={handleUsernameSuccess}
                />
            )}

            {user && (
                <CreatePostModal
                    visible={showCreateModal}
                    userId={user.id}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handlePostSuccess}
                />
            )}
        </SafeAreaView>
    );
}
