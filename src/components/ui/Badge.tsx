type Variant = "blue" | "green" | "red" | "yellow" | "gray"

const variants: Record<Variant, string> = {
  blue: "bg-[#ebf3fe] text-[#3182f6]",
  green: "bg-[#e5f9f0] text-[#05c072]",
  red: "bg-[#fff0f1] text-[#f04452]",
  yellow: "bg-amber-50 text-amber-600",
  gray: "bg-[#f2f4f6] text-[#6b7684]",
}

export default function Badge({
  children,
  variant = "gray",
}: {
  children: React.ReactNode
  variant?: Variant
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-semibold ${variants[variant]}`}
    >
      {children}
    </span>
  )
}
