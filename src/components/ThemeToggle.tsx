"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // useEffect only runs on the client, so now we can safely show the UI
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-9 h-9" />; // Placeholder to prevent layout shift
    }

    return (
        <div className="flex items-center gap-1 p-1 bg-surface/50 border border-border rounded-full backdrop-blur-sm">
            <button
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded-full transition-all duration-200 ${theme === "light"
                        ? "bg-primary text-white shadow-sm"
                        : "text-text-muted hover:text-text hover:bg-white/10"
                    }`}
                aria-label="Light mode"
            >
                <Sun className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("system")}
                className={`p-1.5 rounded-full transition-all duration-200 ${theme === "system"
                        ? "bg-primary text-white shadow-sm"
                        : "text-text-muted hover:text-text hover:bg-white/10"
                    }`}
                aria-label="System mode"
            >
                <Laptop className="w-4 h-4" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded-full transition-all duration-200 ${theme === "dark"
                        ? "bg-primary text-white shadow-sm"
                        : "text-text-muted hover:text-text hover:bg-white/10"
                    }`}
                aria-label="Dark mode"
            >
                <Moon className="w-4 h-4" />
            </button>
        </div>
    );
}
