# MSS・香澄 4年生アプリ（予定・駐車場抽選・大会要項）

公開先（予定）：`https://hikarusue-rgb.github.io/soccer-parking/mss4/`（`?grade=g4` 省略時は4年生）

- 画面：Vite＋React＋TypeScript（ビルドして GitHub Pages の `mss4/` に置く）
- データ・認証・ファイル：Firebase `soccer-parking` プロジェクト
  - Realtime Database `/mss/{grade}/…`（権限は `database.rules.json`）
  - Authentication：学年ごとに「保護者」「コーチ」の2アカウント（合言葉＝パスワード）
  - Cloud Storage `mss/{grade}/files/…`（権限は `storage.rules`）
- 既存の `/pro/`（駐車場抽選PRO）と `/calendar/` は変更しない。旧アプリのDBパスはルールの `$legacy` で従来どおり開けている

## 開発（本番には接続しない）

前提：Node 22.12 以降、Java 21（`../tools/jre21` に展開済み。PATH は変えずにスクリプト内で使う）

```bash
npm install
npm run emulators        # Auth・Database・Storage のエミュレータを起動（別ターミナル）
npm run seed             # テスト用アカウントと4年生のデータを投入
npm run dev              # http://127.0.0.1:5174/soccer-parking/mss4/
```

- テスト用の合言葉は `scripts/seed-emulator.ts` の `DEV_ACCOUNTS`（エミュレータ専用）
- `npm run seed` は移行ドライランの出力（`../work/migration/mss-g4.json`）があればそれを使い、なければ架空のデータを入れる。`node scripts/seed-emulator.ts --synthetic` で常に架空のデータ

## テスト

```bash
npm test                 # 単体テスト（日付・画面切替・移行ロジックなど）
npm run test:rules       # 権限ルールのテスト（エミュレータを自動で起動・終了）
npm run typecheck
```

## 移行ドライラン（本番は読み取りのみ）

```bash
node scripts/migrate.ts                                   # カレンダーは初期データ（seed.ts）を使用
node scripts/migrate.ts --calendar <バックアップJSON>     # カレンダーのコーチ画面で保存したJSONを使用
```

出力は `../work/migration/`。`mss-g4.json` と `source-*.json` には名簿（子どもの名前）が入るため、リポジトリやドキュメントに含めない。`migration-report.md` には名前を含めない。
