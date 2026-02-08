"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeWatcher() {
    const { theme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const checkTimeAndApplyTheme = () => {
            // Only intervene if the user selected "system"
            if (theme === 'system') {
                const hour = new Date().getHours();
                // Define night hours: 10 PM (22) to 6 AM (6)
                // User explicitly mentioned 11 PM being a problem, so ensuring we cover that.
                const isNight = hour >= 22 || hour < 6;

                const html = document.documentElement;

                if (isNight) {
                    // Force dark mode at night for "system" setting
                    if (!html.classList.contains('dark')) {
                        html.classList.add('dark');
                        html.style.colorScheme = 'dark';
                    }
                } else {
                    // During the day, respect the OS/Browser system preference (handled by next-themes default behavior generally)
                    // But if we forced dark previously and now it's day, we should revert to systemTheme
                    // systemTheme is what next-themes detected from OS.

                    if (systemTheme === 'dark') {
                        if (!html.classList.contains('dark')) {
                            html.classList.add('dark');
                            html.style.colorScheme = 'dark';
                        }
                    } else {
                        // System is light (or undefined), so ensure dark is removed
                        if (html.classList.contains('dark')) {
                            html.classList.remove('dark');
                            html.style.colorScheme = 'light';
                        }
                    }
                }
            }
        };

        // Run immediately
        checkTimeAndApplyTheme();

        // Run every minute to check time transitions
        const interval = setInterval(checkTimeAndApplyTheme, 60000);

        return () => clearInterval(interval);
    }, [theme, systemTheme, mounted]);

    return null;
}
