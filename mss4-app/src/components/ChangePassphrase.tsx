import { useId, useState, type FormEvent } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { KeyRound } from "lucide-react";
import { firebase } from "../lib/firebase";

/** コーチの合言葉を変更する（今の合言葉で本人確認してから変える。ほかの端末のコーチのログインは自動で切れる） */
export function ChangePassphrase({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ids = { current: useId(), next: useId(), confirm: useId() };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = next.trim();
    if (!current.trim()) return setError("今の合言葉を入力してください。");
    if (value.length < 6) return setError("新しい合言葉は6文字以上にしてください。");
    if (value !== confirm.trim()) return setError("確認のために入力した合言葉が一致しません。");
    if (value === current.trim()) return setError("今と同じ合言葉です。");
    const user = firebase().auth.currentUser;
    if (!user?.email) return setError("コーチとしてログインし直してから、もう一度お試しください。");
    setBusy(true);
    setError(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current.trim()));
      await updatePassword(user, value);
      setDone(true);
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      setError(
        code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/invalid-login-credentials" ? "今の合言葉が違います。"
          : code === "auth/weak-password" || code === "auth/password-does-not-meet-requirements" ? "新しい合言葉は6文字以上にしてください。"
          : code === "auth/too-many-requests" ? "試行回数が多いため、しばらく時間をおいてからお試しください。"
          : "変更できませんでした。通信状態を確認して、もう一度お試しください。",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card login-card" role="status">
        <h2 className="login-title">コーチの合言葉を変更しました</h2>
        <p>次回からは新しい合言葉でログインしてください。ほかの端末でコーチとしてログインしている場合は、1時間ほどで自動的にログアウトされます。</p>
        <button className="btn btn-primary btn-block" onClick={onClose}>閉じる</button>
      </div>
    );
  }

  const input = (id: string, label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} className="input" type="password" value={value} onChange={(e) => set(e.target.value)} autoComplete={autoComplete}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={busy} />
    </div>
  );

  return (
    <form className="card login-card" onSubmit={submit} noValidate>
      <h2 className="login-title"><KeyRound size={18} aria-hidden="true" /> コーチの合言葉を変更</h2>
      {input(ids.current, "今の合言葉", current, setCurrent, "current-password")}
      {input(ids.next, "新しい合言葉（6文字以上）", next, setNext, "new-password")}
      {input(ids.confirm, "新しい合言葉（確認のためもう一度）", confirm, setConfirm, "new-password")}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? "変更しています…" : "合言葉を変更する"}</button>
      <button className="btn btn-ghost btn-block" type="button" onClick={onClose} disabled={busy}>キャンセル</button>
    </form>
  );
}
