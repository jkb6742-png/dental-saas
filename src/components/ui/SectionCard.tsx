type Props = {
  title?: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export default function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
}: Props) {
  return (
    <div className={`bg-white rounded-2xl shadow-[0_1px_3px_0_rgb(0_0_0/0.06)] overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="px-6 py-5 flex items-center justify-between border-b border-[#f2f4f6]">
          <div>
            {title && (
              <h3 className="text-[16px] font-semibold text-[#191f28]">{title}</h3>
            )}
            {description && (
              <p className="text-[13px] text-[#8b95a1] mt-0.5">{description}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
