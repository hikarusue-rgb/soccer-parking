import { useId, useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { GRADE_LABELS, type GradeCode } from "../lib/grade";
import { signInCoach, signInErrorMessage } from "../lib/session";

/** コーチとしてログイン（閲覧は合言葉なし。編集・抽選・ファイルのアップロードだけコーチの合言葉が必要） */
export function CoachLogin({ grade, onCancel }: { grade: GradeCode; onCancel: () => void }) {
  const [passphrase, setPassphrase] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!passphrase.trim()) {
      setError("合言葉を入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInCoach(grade, passphrase);
      // 成功するとログイン状態が変わり、このダイアログは自動で閉じる
    } catch (err) {
      setError(signInErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card login-card" onSubmit={submit} noValidate>
      <h2 className="login-title">コーチとしてログイン</h2>
      <div className="login-lead">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>予定・要項・駐車場枠の編集、抽選、資料のアップロードができるようになります。予定の確認と車出しのエントリーは、ログインなしでできます。</p>
      </div>
      {/* パスワード管理（iPhoneのキーチェーン・Chromeなど）に保存できるよう、ユーザー名欄を置く（中身は固定） */}
      <div className="field">
        <label className="field-label" htmlFor={`${inputId}-user`}>ID</label>
        <input id={`${inputId}-user`} className="input input-readonly" type="text" name="username" autoComplete="username" value={`MSS香澄${GRADE_LABELS[grade]}コーチ`} readOnly />
      </div>
      <div className="field">
        <label className="field-label" htmlFor={inputId}>コーチ用の合言葉</label>
        <span className="input-with-button">
          <input
            id={inputId}
            className="input"
            type={visible ? "text" : "password"}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            name="password"
            enterKeyHint="go"
            disabled={busy}
            aria-invalid={error ? true : undefined}
          />
          <button type="button" className="input-addon" onClick={() => setVisible((v) => !v)} aria-label={visible ? "合言葉を隠す" : "合言葉を表示"}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? "確認しています…" : "コーチとしてログイン"}</button>
      <button className="btn btn-ghost btn-block" type="button" onClick={onCancel} disabled={busy}>キャンセル</button>
      <p className="login-note">ログインはこの端末に記憶されます（次回から入力不要）。合言葉はブラウザやiPhoneのパスワード保存にも登録できます。共用の端末では、使い終わったらメニューからログアウトしてください。</p>
    </form>
  );
}
