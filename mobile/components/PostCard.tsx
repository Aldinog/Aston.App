import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

function timeAgo(dateString: string) {
    const now = new Date();
    const past = new Date(dateString);
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const msPerMonth = msPerDay * 30;
    const msPerYear = msPerDay * 365;

    const elapsed = now.getTime() - past.getTime();

    if (elapsed < msPerMinute) {
        return Math.round(elapsed / 1000) + 's';
    } else if (elapsed < msPerHour) {
        return Math.round(elapsed / msPerMinute) + 'm';
    } else if (elapsed < msPerDay) {
        return Math.round(elapsed / msPerHour) + 'h';
    } else if (elapsed < msPerMonth) {
        return Math.round(elapsed / msPerDay) + 'd';
    } else if (elapsed < msPerYear) {
        return Math.round(elapsed / msPerMonth) + 'mo';
    } else {
        return Math.round(elapsed / msPerYear) + 'y';
    }
}

interface PostCardProps {
    post: {
        id: string;
        content: string;
        image_url?: string | null;
        cashtags?: string[] | null;
        sentiment?: 'BULLISH' | 'BEARISH' | null;
        created_at: string;
        like_count: number;
        comment_count: number;
        user: {
            username: string;
            avatar_url?: string | null;
        };
        is_liked?: boolean; // Optimistic UI
    };
    onLike: (id: string) => void;
    onComment: (id: string) => void;
    onUserPress: (userId: string) => void;
    onReport: (id: string) => void;
}

export default function PostCard({ post, onLike, onComment, onUserPress, onReport }: PostCardProps) {
    const timeAgoStr = useMemo(() => {
        return timeAgo(post.created_at);
    }, [post.created_at]);

    // Cashtag highlighting logic
    const renderContent = () => {
        const parts = post.content.split(/(\$[A-Z]+)/g);
        return (
            <Text className="text-slate-300 text-base leading-6">
                {parts.map((part, index) => {
                    if (part.startsWith('$') && part.length > 1) {
                        return (
                            <Text key={index} className="text-primary font-bold">
                                {part}
                            </Text>
                        );
                    }
                    return <Text key={index}>{part}</Text>;
                })}
            </Text>
        );
    };

    return (
        <View className="bg-slate-900 border-b border-white/5 py-4 px-5">
            <View className="flex-row">
                {/* Avatar */}
                <TouchableOpacity onPress={() => onUserPress(post.user.username)}>
                    <View className="w-10 h-10 bg-slate-700 rounded-full mr-3 overflow-hidden">
                        {post.user.avatar_url ? (
                            <Image source={{ uri: post.user.avatar_url }} className="w-full h-full" />
                        ) : (
                            <View className="w-full h-full justify-center items-center bg-slate-800">
                                <Text className="text-slate-400 font-bold text-sm">
                                    {post.user.username?.[0]?.toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Content */}
                <View className="flex-1">
                    {/* Header */}
                    <View className="flex-row justify-between items-start mb-1">
                        <View className="flex-row items-center flex-wrap flex-1 mr-2">
                            <Text className="text-white font-bold text-base mr-1.5">
                                {post.user.username || 'Anonymous'}
                            </Text>

                            {/* Pro Badge (Mockup for now) */}
                            {/* <Ionicons name="checkmark-circle" size={14} color="#38BDF8" style={{ marginRight: 6 }} /> */}

                            <Text className="text-slate-500 text-xs">{timeAgoStr}</Text>
                        </View>

                        <TouchableOpacity onPress={() => onReport(post.id)} className="p-1">
                            <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    {/* Sentiment Badge */}
                    {post.sentiment && (
                        <View className={`self-start px-2 py-0.5 rounded-md mb-2 ${post.sentiment === 'BULLISH' ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                            <Text className={`text-[10px] font-bold ${post.sentiment === 'BULLISH' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                {post.sentiment}
                            </Text>
                        </View>
                    )}

                    {/* Text Body */}
                    <View className="mb-3">
                        {renderContent()}
                    </View>

                    {/* Image Attachment */}
                    {post.image_url && (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            className="w-full h-48 bg-slate-800 rounded-xl mb-3 overflow-hidden border border-white/5"
                        >
                            <Image
                                source={{ uri: post.image_url }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    )}

                    {/* Footer Actions */}
                    <View className="flex-row justify-between items-center mt-1 pr-4">
                        <TouchableOpacity onPress={() => onComment(post.id)} className="flex-row items-center space-x-1.5 gap-1.5">
                            <Ionicons name="chatbubble-outline" size={18} color="#94A3B8" />
                            <Text className="text-slate-400 text-xs font-medium">{post.comment_count || 0}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => onLike(post.id)} className="flex-row items-center space-x-1.5 gap-1.5">
                            <Ionicons
                                name={post.is_liked ? "heart" : "heart-outline"}
                                size={18}
                                color={post.is_liked ? "#EF4444" : "#94A3B8"}
                            />
                            <Text className={`${post.is_liked ? 'text-red-400' : 'text-slate-400'} text-xs font-medium`}>
                                {post.like_count || 0}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity className="flex-row items-center space-x-1.5 gap-1.5">
                            <Ionicons name="share-social-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}
