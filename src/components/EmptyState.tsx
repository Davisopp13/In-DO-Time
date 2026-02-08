import Image from 'next/image'

interface EmptyStateProps {
  title: string
  children: React.ReactNode
}

export default function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center glass-card py-16 px-6 text-center">
      <div className="relative mb-6 h-16 w-24 opacity-80 dark:opacity-50 dark:invert filter">
        <Image
          src="/DO_CODE_LAB_LOGO.png"
          alt=""
          fill
          className="object-contain"
          priority={false}
        />
      </div>
      <p className="mb-2 text-lg font-bold text-text dark:text-white">{title}</p>
      <div className="text-text-muted max-w-sm">{children}</div>
    </div>
  )
}
