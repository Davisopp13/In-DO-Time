export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-text-muted">Loading...</span>
      </div>
    </div>
  )
}
