import { useState, useEffect, useRef } from 'react';
import { Check, Lightbulb, Zap } from 'lucide-react';

export function QuickFixButton({ text, onApply }: { text: string; onApply: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApply = () => {
    onApply(text);
    setApplied(true);
    setOpen(false);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 border-none rounded px-2 py-1 cursor-pointer inline-flex items-center justify-center transition-all duration-200 ease-in-out ${
          open ? 'bg-yellow-500/15 text-yellow-500' : applied ? 'bg-transparent text-green-500' : 'bg-transparent text-gray-400 hover:text-gray-300'
        }`}
        title="Quick Fix"
      >
        {applied ? <Check size={14} /> : <Lightbulb size={14} />}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-white/10 rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.4)] min-w-[160px] z-[1000] overflow-hidden">
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-2 w-full px-3 py-2 border-none bg-transparent hover:bg-white/5 text-gray-100 text-xs font-medium cursor-pointer text-left"
          >
            <Zap size={14} className="text-yellow-500" />
            <span>Apply AI Fix</span>
          </button>
        </div>
      )}
    </div>
  );
}
