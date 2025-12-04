import React from 'react';
import { Minus, Plus, X, LucideIcon } from 'lucide-react';

export const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerActive' | 'success' | 'active';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  icon?: LucideIcon;
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, onClick, variant = 'primary', className = '', icon: Icon, disabled, title, size = 'md', active, type = "button", ...props 
}) => {
  const sizeClasses = { xs: "px-2 py-1 text-xs", sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base", icon: "p-2 aspect-square" };
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-500",
    ghost: "text-slate-400 hover:text-indigo-300 hover:bg-white/5 bg-transparent border border-transparent",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/50",
    dangerActive: "bg-red-600 text-white border border-red-500 shadow-lg shadow-red-500/20", 
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg border border-emerald-500/50",
    active: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
  };
  return (
    <button 
      type={type} 
      onClick={onClick} 
      disabled={disabled} 
      title={title} 
      className={cn(
        "flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100", 
        sizeClasses[size], 
        active ? variants.active : variants[variant], 
        className
      )}
      {...props}
    >
      {Icon && <Icon size={size === 'icon' ? 18 : (size === 'sm' ? 14 : 16)} className={cn(children ? "mr-2" : "", "shrink-0")} />} {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className, ...props }) => (
  <div className={cn("flex flex-col group", className)}>
    {label && <label className="text-xs text-slate-400 mb-1.5 font-medium ml-1 group-focus-within:text-indigo-400 transition-colors">{label}</label>}
    <input className="bg-slate-900/50 border border-slate-700/50 text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder-slate-600 text-sm disabled:opacity-30 shadow-inner" {...props} />
  </div>
);

// --- Textarea ---
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, className, rows = 3, ...props }) => (
  <div className={cn("flex flex-col w-full group", className)}>
    {label && <label className="text-xs text-slate-400 mb-1.5 font-medium ml-1 group-focus-within:text-indigo-400 transition-colors">{label}</label>}
    <textarea rows={rows} className="bg-slate-900/50 border border-slate-700/50 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder-slate-600 text-sm resize-none custom-scrollbar shadow-inner" {...props} />
  </div>
);

// --- Number Stepper ---
interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({ value, onChange, min = 0, max = 999, className }) => {
    const handleDecrement = () => onChange(Math.max(min, Number(value || 0) - 1));
    const handleIncrement = () => onChange(Math.min(max, Number(value || 0) + 1));
    return (
        <div className={cn("flex items-center bg-[#020617] border border-slate-700 rounded-xl h-10 overflow-hidden shadow-sm", className)}>
            <button type="button" onClick={handleDecrement} className="w-9 h-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center shrink-0 active:bg-slate-700"><Minus size={16} /></button>
            <input 
              type="number" 
              className="flex-1 w-full bg-transparent text-center text-base font-bold text-white font-mono focus:outline-none appearance-none m-0 px-0 h-full min-w-[2rem] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" 
              value={value} 
              onChange={(e) => { const val = e.target.value; if (val === '') onChange(0); else onChange(parseInt(val)); }} 
              onBlur={() => { let val = Number(value); if (isNaN(val)) val = min; if (val < min) val = min; if (val > max) val = max; onChange(val); }} 
            />
             <button type="button" onClick={handleIncrement} className="w-9 h-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center justify-center shrink-0 active:bg-slate-700"><Plus size={16} /></button>
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
}

export const Modal: React.FC<ModalProps> = ({ onClose, children, className, title, icon: Icon }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
    <div className={cn("glass-panel bg-[#0f172a] rounded-3xl w-full relative z-10 overflow-hidden animate-slide-up shadow-2xl flex flex-col max-h-[90vh]", className)}>
        {title && (
          <div className="px-6 md:px-8 py-4 md:py-6 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
            <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3">
              {Icon && <Icon size={24} className="text-indigo-400"/>}
              {title}
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24}/></button>
          </div>
        )}
        {!title && <button onClick={onClose} className="absolute top-4 right-4 z-20 text-slate-400 hover:text-white"><X size={24}/></button>}
        {children}
    </div>
  </div>
);

// --- ProgressBar ---
export const ProgressBar: React.FC<{ value: number; max?: number; colorClass: string; bgClass: string; height?: string }> = ({ value, max = 100, colorClass, bgClass, height = "h-1.5" }) => {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className={`w-full ${bgClass} rounded-full overflow-hidden ${height}`}>
            <div className={`h-full ${colorClass} transition-all duration-500 ease-out`} style={{ width: `${percent}%` }} />
        </div>
    );
};

// --- StatBadge ---
export const StatBadge: React.FC<{ label: string; value: number; max?: number; color: 'red' | 'emerald' | 'blue' | 'amber' | 'slate'; icon?: LucideIcon }> = ({ label, value, max = 100, color = "indigo", icon: Icon }) => {
    const colorMap = {
        red: { text: "text-red-400", bg: "bg-red-500", track: "bg-red-950/40" },
        emerald: { text: "text-emerald-400", bg: "bg-emerald-500", track: "bg-emerald-950/40" },
        blue: { text: "text-blue-400", bg: "bg-blue-500", track: "bg-blue-950/40" },
        amber: { text: "text-amber-400", bg: "bg-amber-500", track: "bg-amber-950/40" },
        slate: { text: "text-slate-400", bg: "bg-slate-500", track: "bg-slate-800/40" },
    };
    const c = colorMap[color] || colorMap.slate;
    return (
        <div className="flex flex-col min-w-[3.5rem] gap-1.5">
            <div className="flex items-end justify-between px-0.5">
                <div className="flex items-center gap-1">
                     {Icon && <Icon size={10} className="text-slate-500" />}
                     <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
                </div>
                <span className={cn("font-bold text-sm leading-none font-mono", c.text)}>{value}</span>
            </div>
            <ProgressBar value={value} max={max} colorClass={c.bg} bgClass={c.track} />
        </div>
    );
};
