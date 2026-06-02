"use client"

import { forwardRef } from "react"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

const variants: Record<Variant, string> = {
  primary: "bg-[#3182f6] hover:bg-[#1b64da] text-white",
  secondary: "bg-[#f2f4f6] hover:bg-[#e5e8eb] text-[#191f28]",
  ghost: "bg-transparent hover:bg-[#f2f4f6] text-[#4e5968]",
  danger: "bg-[#f04452] hover:bg-[#d63a47] text-white",
}

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[13px] rounded-[8px]",
  md: "px-4 py-2.5 text-[14px] rounded-[10px]",
  lg: "px-5 py-3 text-[15px] rounded-[12px]",
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", loading, children, disabled, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 font-semibold
          transition-all duration-150 cursor-pointer select-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variants[variant]} ${sizes[size]} ${className}
        `}
        {...props}
      >
        {loading && (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export default Button
