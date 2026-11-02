import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase, type Database } from "firebase/database";
import { FIREBASE_CONFIG, TARGET } from "./config";

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Database;
}

let services: Services | null = null;

/**
 * Firebase の初期化（開発時はローカルのエミュレータにだけ接続する）。
 * ログイン（Auth）は使うときだけ準備する。合言葉なしで使う今は準備しないので、
 * 端末に古いログイン情報が残っていても、データの読み込みがログインの確認待ちで止まらない。
 */
export function firebase(): Services {
  if (services) return services;
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getDatabase(app);
  if (TARGET === "emulator") connectDatabaseEmulator(db, "127.0.0.1", 9000);
  let auth: Auth | null = null;
  services = {
    app,
    db,
    get auth() {
      if (!auth) {
        auth = getAuth(app);
        if (TARGET === "emulator") connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      }
      return auth;
    },
  };
  return services;
}

/** ファイルのアップロード・削除のときだけ Storage を読み込む（閲覧はダウンロードURLで行う） */
export async function storage() {
  const mod = await import("firebase/storage");
  const instance = mod.getStorage(firebase().app);
  if (TARGET === "emulator" && !(instance as { _mssEmulator?: boolean })._mssEmulator) {
    mod.connectStorageEmulator(instance, "127.0.0.1", 9199);
    (instance as { _mssEmulator?: boolean })._mssEmulator = true;
  }
  return { ...mod, instance };
}
