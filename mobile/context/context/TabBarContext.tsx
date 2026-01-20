import React, { createContext, useContext } from 'react';
import { useSharedValue, SharedValue } from 'react-native-reanimated';

type TabBarContextType = {
    tabBarTranslateY: SharedValue<number>;
};

const TabBarContext = createContext<TabBarContextType | null>(null);

export const TabBarProvider = ({ children }: { children: React.ReactNode }) => {
    // Value: 0 = Visible, >0 = Hidden down
    const tabBarTranslateY = useSharedValue(0);

    return (
        <TabBarContext.Provider value={{ tabBarTranslateY }}>
            {children}
        </TabBarContext.Provider>
    );
};

export const useTabBar = () => {
    const context = useContext(TabBarContext);
    if (!context) throw new Error('useTabBar must be used within a TabBarProvider');
    return context;
};
