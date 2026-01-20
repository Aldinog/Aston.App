import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Constants from 'expo-constants';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    resetError = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <ScrollView contentContainerStyle={styles.scroll}>
                        <Text style={styles.title}>Oops, Something Went Wrong</Text>
                        <Text style={styles.errorText}>
                            {this.state.error?.toString()}
                        </Text>
                        {this.state.errorInfo && (
                            <Text style={styles.stackTrace}>
                                {this.state.errorInfo.componentStack}
                            </Text>
                        )}
                        <TouchableOpacity style={styles.button} onPress={this.resetError}>
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a', // Dark background matching app theme
        paddingTop: Constants.statusBarHeight + 20,
        paddingHorizontal: 20,
    },
    scroll: {
        paddingBottom: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ef4444', // Red 500
        marginBottom: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#ffffff',
        marginBottom: 20,
    },
    stackTrace: {
        fontSize: 12,
        color: '#94a3b8',
        fontFamily: 'monospace',
        marginBottom: 20,
        backgroundColor: '#1e293b',
        padding: 10,
        borderRadius: 8,
    },
    button: {
        backgroundColor: '#3b82f6',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
