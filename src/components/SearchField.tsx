import { useEffect, useRef, useState } from 'react';
import { IconSearch } from './Icons';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Свёрнут — квадратная кнопка с лупой. По клику раскрывается в строку поиска.
 * Сворачивается обратно по потере фокуса, если ничего не введено.
 */
export function SearchField({ value, onChange, placeholder = 'Поиск по товару…', ariaLabel = 'Поиск по товару' }: SearchFieldProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const toggle = () => {
    if (open) {
      onChange('');
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  return (
    <div className={`search-field${open ? ' open' : ''}`}>
      <button type="button" className="sf-btn" onClick={toggle} aria-label={open ? 'Закрыть поиск' : ariaLabel} title={ariaLabel}>
        <IconSearch />
      </button>
      <input
        ref={inputRef}
        className="sf-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        tabIndex={open ? 0 : -1}
      />
    </div>
  );
}
