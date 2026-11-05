import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = { value: string; label: string };

type MenuPos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

export function SelectField({
  value,
  defaultValue,
  onChange,
  options,
  placeholder = 'Seleccionar',
  required = false,
  disabled = false,
  name,
  id,
  'aria-label': ariaLabel,
  className = '',
  size = 'md',
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
  size?: 'md' | 'sm';
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [inner, setInner] = useState(value ?? defaultValue ?? '');
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [active, setActive] = useState(0);
  const current = value ?? inner;
  const searchable = options.length > 8;

  const selected = options.find((option) => option.value === current);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    if (value !== undefined) setInner(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 6;
      const estimated = Math.min(320, 56 + filtered.length * 42);
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
      setPos({
        left,
        width,
        top: openUp ? undefined : rect.bottom + gap,
        bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
        maxHeight: Math.max(160, openUp ? Math.min(320, spaceAbove) : Math.min(320, spaceBelow, estimated + 48)),
      });
    }

    place();
    const selectedIndex = Math.max(0, filtered.findIndex((option) => option.value === current));
    setActive(selectedIndex);
    const onWin = () => place();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    const frame = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      window.clearTimeout(frame);
    };
  }, [open, filtered, current]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function commit(next: string) {
    if (value === undefined) setInner(next);
    onChange?.(next);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(filtered.length - 1, index + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[active];
      if (option) commit(option.value);
    }
  }

  const label = selected?.label ?? placeholder;
  const empty = !selected;

  return (
    <div className={`field-select ${className}`}>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <select
        className="field-select-native"
        tabIndex={-1}
        required={required}
        disabled={disabled}
        value={current}
        aria-hidden
        onChange={(event) => commit(event.target.value)}
      >
        {!options.some((option) => option.value === '') ? <option value="" /> : null}
        {options.map((option) => (
          <option key={option.value || 'empty'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        className={`field-select-trigger ${size === 'sm' ? 'field-select-trigger-sm' : ''} ${open ? 'is-open' : ''} ${empty ? 'is-empty' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((next) => !next);
          setQuery('');
        }}
        onKeyDown={onKeyDown}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <svg className="field-select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              className="field-select-menu"
              style={{
                left: pos.left,
                width: pos.width,
                top: pos.top,
                bottom: pos.bottom,
                maxHeight: pos.maxHeight,
              }}
            >
              {searchable ? (
                <div className="field-select-search">
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder="Procurar…"
                    aria-label="Procurar opção"
                  />
                </div>
              ) : null}
              <div className="field-select-options">
                {filtered.length === 0 ? (
                  <p className="field-select-empty">Sem resultados</p>
                ) : (
                  filtered.map((option, index) => {
                    const isSelected = option.value === current;
                    return (
                      <button
                        key={option.value || `empty-${index}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`field-select-option ${isSelected ? 'is-selected' : ''} ${index === active ? 'is-active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => commit(option.value)}
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {isSelected ? (
                          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden>
                            <path d="M4.5 10.5 8 14l7.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
