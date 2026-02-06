import Image from 'next/image'

interface EmptyStateProps {
  title: string
  children: React.ReactNode
}

export default function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-border bg-background py-16 shadow-card">
      <Image
        src="/DO_CODE_LAB_LOGO_NO_TEXT.png"
        alt=""
        width={64}
        height={64}
        className="mb-4 opacity-20"
      />
      <p className="mb-2 text-lg font-semibold text-text">{title}</p>
      <p className="text-text-muted text-center px-4">{children}</p>
    </div>
  )
}
