// Firebase エミュレータ用に、tools/jre21（または JAVA_HOME）の Java を PATH に足してコマンドを実行する。
// システムの PATH や環境設定は変更しない。
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const exe = process.platform === "win32" ? "java.exe" : "java";
const candidates = [
  process.env.JAVA_HOME && join(process.env.JAVA_HOME, "bin"),
  resolve(here, "../../tools/jre21/bin"),
].filter(Boolean);
const javaBin = candidates.find((dir) => existsSync(join(dir, exe)));
if (!javaBin) {
  console.error("Java が見つかりません。tools/jre21 を展開するか JAVA_HOME を設定してください。");
  process.exit(1);
}

const env = { ...process.env };
const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") ?? "PATH";
env[pathKey] = javaBin + delimiter + (env[pathKey] ?? "");

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("使い方: node scripts/with-java.mjs <command> [...args]");
  process.exit(1);
}
const quoted = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
const child = spawn(command, quoted, { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 1));
