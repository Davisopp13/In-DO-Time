export default function Loading() {
  return (
    <div className="content-enter flex min-h-[42vh] items-center justify-center py-16">
      <div className="glass-panel flex items-center gap-4 rounded-full px-5 py-3 shadow-card">
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 rounded-full border border-primary/20" />
          <div className="loading-orbit absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary/60" />
        </div>
        <div className="space-y-1">
          <span className="block text-sm font-medium text-text">Loading In DO Time</span>
          <span className="block h-1.5 w-28 overflow-hidden rounded-full bg-surface-foreground/10 dark:bg-white/10">
            <span className="skeleton block h-full w-full rounded-full" />
          </span>
        </div>
      </div>
    </div>
  )
}
