import { TextInput as RNTextInput, View, Text, TextInputProps } from 'react-native';
import clsx from 'clsx';
import { useState } from 'react';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    className?: string;
    icon?: React.ReactNode;
}

export default function Input({ label, error, className, icon, onFocus, onBlur, ...props }: InputProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View className={clsx("mb-4", className)}>
            {label && <Text className="text-muted-foreground mb-2 font-medium ml-1">{label}</Text>}

            <View
                className={clsx(
                    "w-full h-12 bg-card rounded-xl border flex-row items-center px-4 transition-all",
                    isFocused ? "border-primary" : "border-input",
                    error ? "border-destructive" : ""
                )}
            >
                {icon && <View className="mr-3">{icon}</View>}

                <RNTextInput
                    placeholderTextColor="rgb(var(--muted-foreground))"
                    className="flex-1 text-foreground text-base h-full"
                    onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
                    onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
                    {...props}
                />
            </View>

            {error && <Text className="text-destructive text-sm mt-1 ml-1">{error}</Text>}
        </View>
    );
}
