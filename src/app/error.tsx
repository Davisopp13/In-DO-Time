'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="rounded-card border border-red-200 bg-red-50 p-6 text-center max-w-md">
        <h2 className="mb-2 text-lg font-semibold text-red-700">Something went wrong</h2>
        <p className="mb-4 text-sm text-red-600">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
