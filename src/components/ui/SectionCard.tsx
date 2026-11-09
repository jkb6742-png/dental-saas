type Props = {
  title?: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export default function SectionCard({
  title,
  description,
  action,
  icon,
  children,
  className = "",
}: Props) {
  return (
    <div className={`bg-white rounded border border-[#b9b9b3] overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-3 py-2 flex items-center justify-between gap-3 bg-[#ecece9] border-b border-[#d1d1cc]">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <div className="text-[#555555]">{icon}</div>}
            <div className="flex items-baseline gap-2 min-w-0">
              {title && (
                <h3 className="text-[15px] font-bold text-[#0a0a0a] truncate">{title}</h3>
              )}
              {description && (
                <p className="text-[12px] text-[#6f6f6a] truncate">{description}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="px-3 py-3">{children}</div>
    </div>
  )
}
