import { useEffect, useRef, useState } from "react";
import { EllipsisVertical, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { GRADE_LABELS, type GradeCode, type Role } from "../lib/grade";

interface Props {
  grade: GradeCode;
  role: Role;
  onCoachLogin: () => void;
  onChangePassphrase: () => void;
  onLogout: () => void;
}

export function AppHeader({ grade, role, onCoachLogin, onChangePassphrase, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const coach = role === "coach";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>
            <span className="brand-team">MSS・香澄</span>
            <strong className="brand-grade">{GRADE_LABELS[grade]}</strong>
          </span>
        </div>
        <div className="header-menu" ref={menuRef}>
          <button className="icon-btn" aria-label="メニュー" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <EllipsisVertical size={20} />
          </button>
          {open && (
            <div className="menu" role="menu">
              {coach ? (
                <>
                  <button role="menuitem" onClick={() => { setOpen(false); onChangePassphrase(); }}>
                    <KeyRound size={17} aria-hidden="true" />コーチの合言葉を変更
                  </button>
                  <button role="menuitem" onClick={() => { setOpen(false); onLogout(); }}>
                    <LogOut size={17} aria-hidden="true" />コーチのログアウト
                  </button>
                </>
              ) : (
                <button role="menuitem" onClick={() => { setOpen(false); onCoachLogin(); }}>
                  <KeyRound size={17} aria-hidden="true" />コーチとしてログイン
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {coach && (
        <p className="auth-status is-coach">
          <ShieldCheck size={15} aria-hidden="true" />
          合言葉で認証済み・コーチ（編集できます）
        </p>
      )}
    </header>
  );
}
