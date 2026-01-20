import { TextInput as RNTextInput, View, Text, TextInputProps } from 'react-native';
import clsx from 'clsx';
import { useState } from 'react';
import { useColorScheme } from "nativewind";

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    className?: string;
    icon?: React.ReactNode;
}

export default function Input({ label, error, className, icon, onFocus, onBlur, ...props }: InputProps) {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <View className={`w-full ${className}`}>
            {label && <Text className="text-foreground font-medium mb-1.5 ml-1">{label}</Text>}
            <View className={`
                flex-row items-center w-full px-4 h-14 rounded-2xl border
                ${error ? 'border-destructive' : 'border-border'}
                bg-secondary
            `}>
                {icon && <View className="mr-3">{icon}</View>}
                <RNTextInput
                    className="flex-1 text-foreground text-base h-full"
                    placeholderTextColor={isDark ? '#9CA3AF' : '#6B7280'} // gray-400 (dark) vs gray-500 (light)
                    {...props}
                />
            </View>
            {error && <Text className="text-destructive text-sm mt-1 ml-1">{error}</Text>}
        </View>
    );
}
