import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { firebase } from "./firebase";
import { accountEmail, roleOf, type GradeCode, type Role } from "./grade";

/** 閲覧は合言葉なし（role: "parent"）。コーチの合言葉でログインした端末だけ role: "coach" */
export type Session = { status: "loading" } | { status: "ready"; role: Role; uid: string | null };

export function useSession(grade: GradeCode): Session {
  const [session, setSession] = useState<Session>({ status: "loading" });
  useEffect(() => {
    const { auth } = firebase();
    return onAuthStateChanged(auth, (user) => {
      const coach = roleOf(user?.email, grade) === "coach";
      setSession({ status: "ready", role: coach ? "coach" : "parent", uid: user?.uid ?? null });
    });
  }, [grade]);
  return session;
}

/** コーチとしてログイン（この端末に記憶。合言葉が変わると自動でログアウトされる） */
export async function signInCoach(grade: GradeCode, passphrase: string): Promise<void> {
  await signInWithEmailAndPassword(firebase().auth, accountEmail(grade, "coach"), passphrase.trim());
}

export async function logOut(): Promise<void> {
  await signOut(firebase().auth);
}

export function signInErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
    case "auth/missing-password":
      return "コーチ用の合言葉が違います。";
    case "auth/too-many-requests":
      return "試行回数が多いため、しばらく時間をおいてから入力してください。";
    case "auth/network-request-failed":
      return "通信できませんでした。電波の良い場所で、もう一度お試しください。";
    case "auth/user-disabled":
      return "この合言葉は現在使えません。";
    default:
      return `ログインできませんでした。時間をおいて再度お試しください。${code ? `（${code}）` : ""}`;
  }
}
