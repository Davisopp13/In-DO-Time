'use client'

import { isDemoMode } from '@/lib/supabase'
import { resetMockDataStore } from '@/lib/mockData'
import { useState } from 'react'

export default function DemoBanner() {
  const [isVisible, setIsVisible] = useState(true)
  const inDemoMode = isDemoMode()

  if (!inDemoMode || !isVisible) {
    return null
  }

  const handleReset = () => {
    resetMockDataStore()
    window.location.reload()
  }

  return (
    <div className="relative bg-gradient-to-r from-accent/20 via-accent/10 to-accent/20 border-b border-accent/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Demo Icon */}
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-accent"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text dark:text-white">
                <span className="hidden sm:inline">You're viewing a </span>
                <span className="font-bold text-accent">live demo</span>
                <span className="hidden sm:inline"> with sample data. All changes are temporary and reset on page refresh.</span>
                <span className="sm:hidden"> - Changes are temporary</span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleReset}
              className="px-3 py-1 text-xs font-medium rounded-full bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 transition-colors whitespace-nowrap"
              title="Reset demo data"
            >
              Reset Demo
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 rounded-full hover:bg-surface-foreground/10 dark:hover:bg-white/10 transition-colors"
              title="Dismiss banner"
            >
              <svg
                className="w-4 h-4 text-text-muted"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
