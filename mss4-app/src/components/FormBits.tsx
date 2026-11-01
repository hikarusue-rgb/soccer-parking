import { useId, type ReactNode } from "react";

/** ラベル付きの入力欄。children に入力要素の id を渡す */
export function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}

/** 選択式のチップ（押すと選択・解除） */
export function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

/** 見出し付きのグループ（チップ群など、1つの入力欄に結び付かないもの） */
export function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span className="field-label" id={id}>{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  /** "" は未選択 */
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "is-active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
