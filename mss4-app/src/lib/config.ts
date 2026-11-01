import type { FirebaseOptions } from "firebase/app";

/** emulator: 開発用（本番に一切つながらない） / production: 公開版 */
export const TARGET: "emulator" | "production" =
  import.meta.env.VITE_FIREBASE_TARGET === "production" ? "production" : "emulator";

/** 合言葉用アカウントのメールアドレスのドメイン（画面には表示しない） */
export const ACCOUNT_DOMAIN = "soccer-parking.firebaseapp.com";

const PRODUCTION: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  authDomain: "soccer-parking.firebaseapp.com",
  databaseURL: "https://soccer-parking-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "soccer-parking",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
};

const EMULATOR: FirebaseOptions = {
  apiKey: "demo-key",
  appId: "demo-app",
  authDomain: "demo-mss4.firebaseapp.com",
  databaseURL: "https://demo-mss4-default-rtdb.firebaseio.com",
  projectId: "demo-mss4",
  storageBucket: "demo-mss4.appspot.com",
};

export const FIREBASE_CONFIG = TARGET === "production" ? PRODUCTION : EMULATOR;

/** 公開版で必要な値がそろっていない場合のメッセージ（そろっていれば null） */
export const CONFIG_ERROR =
  TARGET === "production" && (!PRODUCTION.apiKey || !PRODUCTION.appId)
    ? "アプリの初期設定が完了していません。コーチにお知らせください。"
    : null;
