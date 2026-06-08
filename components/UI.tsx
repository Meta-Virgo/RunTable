import React from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X, LucideIcon } from "lucide-react";

export const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger"
    | "dangerActive"
    | "success"
    | "active"
    | "primarySoft";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  icon?: LucideIcon;
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  icon: Icon,
  disabled,
  title: _title,
  size = "md",
  active,
  type = "button",
  ...props
}) => {
  const sizeClasses = {
    xs: "px-2 py-1 text-xs",
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2 aspect-square",
  };
  const variants = {
    primary:
      "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50",
    secondary:
      "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-500",
    ghost:
      "text-slate-400 hover:text-indigo-300 hover:bg-white/5 bg-transparent border border-transparent",
    danger:
      "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/50",
    dangerActive:
      "bg-red-600 text-white border border-red-500 shadow-lg shadow-red-500/20",
    success:
      "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg border border-emerald-500/50",
    active: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
    primarySoft:
      "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/50",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100",
        sizeClasses[size],
        active ? variants.active : variants[variant],
        className
      )}
      {...props}
    >
      {Icon && (
        <Icon
          size={size === "icon" ? 18 : size === "sm" ? 14 : 16}
          className={cn(children ? "mr-2" : "", "shrink-0")}
        />
      )}{" "}
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className, ...props }) => (
  <div className={cn("flex flex-col group", className)}>
    {label && (
      <label className="text-xs text-slate-400 mb-1.5 font-medium ml-1 group-focus-within:text-indigo-400 transition-colors">
        {label}
      </label>
    )}
    <input
      className="bg-slate-900/50 border border-slate-700/50 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder-slate-600 text-sm disabled:opacity-30 shadow-inner"
      {...props}
    />
  </div>
);

// --- Textarea ---
interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  className,
  rows = 3,
  ...props
}) => (
  <div className={cn("flex flex-col w-full group", className)}>
    {label && (
      <label className="text-xs text-slate-400 mb-1.5 font-medium ml-1 group-focus-within:text-indigo-400 transition-colors">
        {label}
      </label>
    )}
    <textarea
      rows={rows}
      className="bg-slate-900/50 border border-slate-700/50 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder-slate-600 text-sm resize-none custom-scrollbar shadow-inner"
      {...props}
    />
  </div>
);

// --- Number Stepper ---
interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  disabled,
  size = "md",
}) => {
  const heightClass = size === "sm" ? "h-8" : "h-10";
  const buttonWidthClass = size === "sm" ? "w-8" : "w-10";
  const fontSizeClass = size === "sm" ? "text-sm" : "text-base";

  // Local state to handle input display
  const [inputValue, setInputValue] = React.useState(String(value));

  // Sync local state when prop value changes
  React.useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleDec = () => {
    if (disabled) return;
    const newVal = value - step;
    if (min !== undefined && newVal < min) return;
    onChange(newVal);
  };
  const handleInc = () => {
    if (disabled) return;
    const newVal = value + step;
    if (max !== undefined && newVal > max) return;
    onChange(newVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const newValStr = e.target.value;

    // Allow empty string, minus sign
    if (newValStr === "" || newValStr === "-") {
      setInputValue(newValStr);
      return;
    }

    // Validate if it's a valid number format (allow digits and single minus at start)
    if (!/^-?\d*$/.test(newValStr)) {
      return;
    }

    setInputValue(newValStr);

    const val = parseInt(newValStr, 10);
    if (!isNaN(val)) {
      // Check max only on input to prevent typing too large numbers, but allow min violations temporarily for typing
      if (max !== undefined && val > max) onChange(max);
      else onChange(val);
    }
  };

  const handleBlur = () => {
    if (disabled) return;
    // On blur, reset to current valid value (handles empty or just "-" case)
    setInputValue(String(value));
    if (min !== undefined && value < min) onChange(min);
  };

  return (
    <div
      className={cn(
        "flex items-center bg-[#020617] rounded-xl border border-slate-700 shadow-sm group hover:border-slate-500 transition-all",
        heightClass,
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        onClick={handleDec}
        disabled={disabled || (min !== undefined && value <= min)}
        className={cn(
          buttonWidthClass,
          "h-full flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-800 rounded-l-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        <Minus size={14} strokeWidth={3} />
      </button>
      <div className="flex-1 h-full border-x border-slate-800 flex items-center justify-center bg-slate-900/50 min-w-[3rem]">
        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()}
          onBlur={handleBlur}
          disabled={disabled}
          className={cn(
            "w-full h-full bg-transparent text-center font-mono font-bold text-white tabular-nums focus:outline-none disabled:cursor-not-allowed appearance-none",
            fontSizeClass
          )}
        />
      </div>
      <button
        type="button"
        onClick={handleInc}
        disabled={disabled || (max !== undefined && value >= max)}
        className={cn(
          buttonWidthClass,
          "h-full flex items-center justify-center text-slate-400 hover:text-white active:bg-slate-800 rounded-r-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  );
};

// --- Modal ---
interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  icon?: LucideIcon;
  headerClassName?: string;
  instant?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  onClose,
  children,
  className,
  title,
  icon: Icon,
  headerClassName,
  instant = false,
}) => {
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4",
        !instant && "animate-fade-in"
      )}
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div
        className={cn(
          "glass-panel bg-[#0f172a] rounded-3xl w-full relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]",
          !instant && "animate-slide-up",
          className
        )}
      >
        {title && (
          <div
            className={cn(
              "px-6 md:px-8 py-4 md:py-6 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0",
              headerClassName
            )}
          >
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
              {Icon && <Icon size={24} className="text-indigo-400" />}
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        )}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
};

// --- ProgressBar ---
export const ProgressBar: React.FC<{
  value: number;
  max?: number;
  colorClass: string;
  bgClass: string;
  height?: string;
}> = ({ value, max = 100, colorClass, bgClass, height = "h-1.5" }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`w-full ${bgClass} rounded-full overflow-hidden ${height}`}>
      <div
        className={`h-full ${colorClass} transition-all duration-500 ease-out`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

// --- StatBadge ---
export const StatBadge: React.FC<{
  label: string;
  value: number;
  max?: number;
  color: "red" | "emerald" | "blue" | "amber" | "slate";
  icon?: LucideIcon;
}> = ({ label, value, max = 100, color = "slate", icon: Icon }) => {
  const colorMap: {
    [K in "red" | "emerald" | "blue" | "amber" | "slate"]: {
      text: string;
      bg: string;
      track: string;
    };
  } = {
    red: { text: "text-red-400", bg: "bg-red-500", track: "bg-red-950/40" },
    emerald: {
      text: "text-emerald-400",
      bg: "bg-emerald-500",
      track: "bg-emerald-950/40",
    },
    blue: { text: "text-blue-400", bg: "bg-blue-500", track: "bg-blue-950/40" },
    amber: {
      text: "text-amber-400",
      bg: "bg-amber-500",
      track: "bg-amber-950/40",
    },
    slate: {
      text: "text-slate-400",
      bg: "bg-slate-500",
      track: "bg-slate-800/40",
    },
  };
  const c = colorMap[color];
  return (
    <div className="flex flex-col min-w-[3.5rem] gap-1.5">
      <div className="flex items-end justify-between px-0.5">
        <div className="flex items-center gap-1">
          {Icon && <Icon size={10} className="text-slate-500" />}
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {label}
          </span>
        </div>
        <span
          className={cn("font-bold text-sm leading-none font-mono", c.text)}
        >
          {value}
        </span>
      </div>
      <ProgressBar
        value={value}
        max={max}
        colorClass={c.bg}
        bgClass={c.track}
      />
    </div>
  );
};
