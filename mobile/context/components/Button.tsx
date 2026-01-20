import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import clsx from 'clsx';

interface ButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    className?: string;
    disabled?: boolean;
}

export default function Button({
    title,
    onPress,
    loading = false,
    variant = 'primary',
    className,
    disabled
}: ButtonProps) {

    const baseStyles = "h-12 rounded-xl flex-row justify-center items-center px-6";

    const variants = {
        primary: "bg-primary active:bg-primary/90",
        secondary: "bg-secondary active:bg-secondary/80 border border-input",
        outline: "bg-transparent border border-input",
        ghost: "bg-transparent active:bg-accent"
    };

    const textStyles = {
        primary: "text-primary-foreground font-bold text-base",
        secondary: "text-secondary-foreground font-medium text-base",
        outline: "text-foreground font-medium",
        ghost: "text-foreground font-medium"
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading || disabled}
            className={clsx(
                baseStyles,
                variants[variant],
                disabled && "opacity-50",
                className
            )}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? 'rgb(var(--primary))' : 'rgb(var(--primary-foreground))'} />
            ) : (
                <Text className={clsx(textStyles[variant])}>{title}</Text>
            )}
        </TouchableOpacity>
    );
}
