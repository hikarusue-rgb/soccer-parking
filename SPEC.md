# 週末スポーツ駐車場・配車・試合情報アプリ — 全体仕様書

最終更新: 2026-05-18

---

## 1. プロダクトコンセプト

**ポジショニング**: 「総合チーム管理アプリ」ではなく **「週末の移動と試合要項確認のストレスをゼロにする特化型アプリ」** とする。

「チャット・アルバム・成績」など LINE / 他アプリで足りる機能には踏み込まない。
「保護者が駐車場を確認するために**必ず開く**」という現状の強みを起点に、隣接ペイン（試合要項の確認・配車調整）を最小コストで吸収する。

---

## 2. 現状（v1.0 — 実装済み）

### 2.1 技術構成
- **フロントエンド**: 単一HTMLファイル（[index.html](index.html)、811行）、React 18 + Babel-standalone をブラウザ実行
- **バックエンド**: Firebase Realtime Database（`soccer-parking-default-rtdb`）
- **環境分離**: [index.html](index.html)（本番）と [index_dev.html](index_dev.html)（DBの `/dev` サブパスを利用）の2系統
- **配信**: GitHub Pages
- **認証**: 無し（`localStorage` で「自分はこのメンバー」を申告するだけ）

### 2.2 実装済み機能
- 名簿管理（背番号・名前・学年）
- 試合作成（タイトル / 試合日時 / 回答締切 / 駐車場上限台数 / 確定枠 / 参加対象学年）
- 出欠回答（参加/欠席、駐車場希望、乗合可能人数）
- あみだくじによる抽選演出
- 抽選結果のLINE文面生成・共有
- 未回答者向け催促テキスト生成

### 2.3 現状のデータモデル（Firebase RTDB）

```
/
├── roster                       # 名簿（配列）
│   └── [{id, num, name, grade}]
├── events                       # 試合一覧（配列）
│   └── [{id, title, matchDate, deadline, parkingLimit,
│          confirmedParking[], inviteGrades[]}]
├── responses
│   └── {eventId}
│       └── {memberId}: {attending, parkingNeeded, carpoolCapacity, at}
└── lotteries
    └── {eventId}: {conducted, conductedAt, winners[]}
```

---

## 3. ロードマップ概要

| Phase | テーマ | リリース目標 | 破壊的変更 |
|---|---|---|---|
| **Phase 1** | 試合要項カード化 | 自チーム継続利用しながら数週 | **なし**（純粋な追加） |
| **Phase 2** | マルチテナント化 | 他チーム配布の準備 | データパスの移行（1回のみ） |
| **Phase 3** | 拡張機能群 | 収益化を狙う場合 | なし（Phase 1/2の上に積む） |

---

## 4. Phase 1: 試合要項カード（次に実装）

### 4.1 目的
コーチからのLINE要項をアプリ内に置き換える。アプリを開けば「今週末の試合に必要な全情報」が見える状態にする。

### 4.2 追加するデータフィールド（events に追加）

| フィールド | 型 | 用途 | 必須 |
|---|---|---|---|
| `opponent` | string | 対戦相手名 | 任意 |
| `location` | string | 試合会場名（Google Maps検索クエリに直接使用） | 任意 |
| `kickoffTime` | string `"HH:MM"` | キックオフ時刻 | 任意 |
| `meetTime` | string `"HH:MM"` | 集合時刻 | 任意 |
| `uniformColor` | string | ユニフォーム色（"白"/"紺" 等の自由入力） | 任意 |
| `notes` | string | その他連絡事項（マルチライン） | 任意 |

**設計原則**:
- すべて任意項目。既存試合は空欄でも動作（後方互換）。
- `matchDate` は既存通り「試合日（datetime-local）」として使い続ける。`kickoffTime` / `meetTime` は時刻のみ別途保持（同じ日に複数時刻が必要なため）。
- **住所フィールドは持たない**。`location`（会場名）を Google Maps の `query` パラメータに渡せば Google が場所を解決してくれるため、別フィールド不要。APIキー・課金設定も不要。
- フィールドを増やしても、データの**保存場所は変わらない** → Phase 2 のマルチテナント化はパスのプレフィックスを変えるだけで吸収可能。

### 4.3 画面変更

#### A. HomeScreen（保護者トップ画面）
- 直近1試合のカードに以下を追加表示:
  - 🆚 対戦相手
  - 📍 会場名
  - ⏰ 集合 / キックオフ
  - 👕 ユニフォーム色
- 情報が無い項目は表示自体を出さない（既存レイアウトを壊さない）。

#### B. EventScreen（試合詳細画面）
- 既存の「参加登録」セクションの**上**に「試合要項」カードを追加。
- 会場名の下に**2つのボタンを並べて配置**（全員に表示）:
  - 🗺 **会場の地図を見る**（`?query={会場名}`）
  - 🅿️ **周辺の駐車場を探す**（`?query={会場名}+コインパーキング`）
- 抽選の当落に関わらず両ボタンを出す。「当選者は会場の地図、落選者はパーキング」と用途を分けず、保護者が自分で判断できるようにする。

#### C. AdminScreen（試合編集フォーム）
- 既存の「タイトル / 日時 / 締切 / 駐車場上限」の下に新規セクション「試合要項（任意）」を追加し、上記6フィールドを入力可能にする。
- 既存ユーザーが「使わない」と判断したら無視できるよう、デフォルトは折りたたみ（アコーディオン）。

### 4.4 Map連携の実装
```js
// 「🗺 会場の地図を見る」ボタン
const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

// 「🅿️ 周辺の駐車場を探す」ボタン
const parkingUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location + " コインパーキング")}`;
```
両方とも `target="_blank"` で外部リンクとして開く。アプリ内に地図埋め込みはしない（APIキー・課金設定の発生を回避）。Google Maps の検索クエリだけで場所を特定できるため、住所フィールドは持たない。

### 4.5 LINE共有テキストの拡張
既存の試合追加お知らせテキストに、要項フィールドが入っていれば自動で追記:

```
⚽ 新しい試合のお知らせ
━━━━━━━━━━━━
📌 {title}
🗓 {matchDate}
🆚 {opponent}                       ← 新規
📍 {location}                       ← 新規
⏰ 集合{meetTime} / KO{kickoffTime}   ← 新規
👕 {uniformColor}                   ← 新規
⏰ 締切: {deadline}
━━━━━━━━━━━━
👇 参加・駐車場の回答はこちら
{url}
```

### 4.6 既存機能への影響
**影響ゼロ**を保証する設計:
- 追加フィールドはすべて任意 → 既存試合データを読み込んでも `undefined` のまま動く。
- データパス（`events`, `responses/`, `lotteries/`, `roster`）は変更しない。
- 抽選ロジック・あみだくじ・確定枠・乗合人数入力は一切触らない。

---

## 5. Phase 2: マルチテナント化

### 5.1 目的
他チームが自分たちのデータで安全に使えるようにする。

### 5.2 データパスの変更（1回限りの移行）

**変更前（現状）**:
```
/roster
/events
/responses/{eventId}
/lotteries/{eventId}
```

**変更後**:
```
/teams/{teamId}/roster
/teams/{teamId}/events
/teams/{teamId}/responses/{eventId}
/teams/{teamId}/lotteries/{eventId}
/teams/{teamId}/meta: {name, createdAt, adminPin?}
```

### 5.3 チーム識別方式（最小コストの案）

URLハッシュ or クエリで `teamId` を渡す:
```
https://hikarusue-rgb.github.io/soccer-parking/?team=abc123
```

- 初回アクセス時に `teamId` を `localStorage` に保存。
- 管理者画面で「新しいチームを作成」ボタン → ランダム `teamId` 生成 → 共有用URL生成。
- 既存自チームは `teamId = "default"` 等でマイグレーション（既存データを `/teams/default/` 配下にコピー）。

### 5.4 認証（最小実装）
- 管理者操作（試合作成・名簿編集・抽選実行）には **チーム管理PIN**（4桁数字）を要求。
- PIN は `/teams/{teamId}/meta/adminPin` にハッシュ化して保存。
- 一般保護者の閲覧・回答にはPIN不要（既存通り）。
- 本格認証（Firebase Auth）は将来課題。

### 5.5 Phase 1 との関係
Phase 1で追加するフィールドはすべて `events[i]` の中に納まる。Phase 2は `events` の**置き場所**を `/events` → `/teams/{teamId}/events` に変えるだけ。**Phase 1 のフィールド設計に変更は不要**。

---

## 6. Phase 3: 拡張機能群（独立に追加可能）

すべて Phase 1/2 の上に**追加するだけ**で実現可能。既存機能を壊さない。

### 6.1 LINEメッセージ自動パース
- 管理者の試合作成画面に「LINE文を貼り付けて自動入力」ボタンを追加。
- 正規表現（または LLM API）で `opponent`, `location`, `kickoffTime` 等を抽出 → Phase 1 のフォームに流し込む。
- **依存**: Phase 1 のフィールド定義のみ。

### 6.2 iCal カレンダーエクスポート
- 試合カードに「📅 カレンダーに追加」ボタン。
- クライアント側で `.ics` を生成しダウンロード（外部サービス不要）。
- **依存**: Phase 1 の `matchDate`, `kickoffTime`, `meetTime`, `location` のみ。

### 6.3 当日朝の自動リマインド
- PWA化 + Web Push API。
- Firebase Cloud Functions で当日朝に通知を送信。
- **依存**: Phase 2 のチーム識別（誰に送るか）。Phase 1 のフィールド（通知内容）。

### 6.4 配車履歴の見える化
- 既存の `responses.carpoolCapacity > 0` のメンバーを月次集計するだけ。
- 新規データ追加は不要。
- **依存**: なし（純粋な集計UI追加）。

### 6.5 匿名表示モード
- チーム設定で「名前を背番号のみで表示」をON/OFF。
- データ構造変更なし、表示層のみ。
- **依存**: なし。

---

## 7. データモデル全体図（Phase 2 完了時の想定）

```
/teams/{teamId}/
├── meta
│   ├── name: string
│   ├── createdAt: number
│   ├── adminPinHash: string
│   └── settings: {
│       useCarpool: boolean,
│       useMatchDetails: boolean,
│       anonymousDisplay: boolean
│       }
├── roster
│   └── [{id, num, name, grade}]
├── events
│   └── [{
│       id, title,
│       matchDate, deadline, parkingLimit,
│       confirmedParking[], inviteGrades[],
│       opponent, location,                          # Phase 1
│       kickoffTime, meetTime, uniformColor, notes   # Phase 1
│       }]
├── responses/{eventId}
│   └── {memberId}: {attending, parkingNeeded, carpoolCapacity, at}
└── lotteries/{eventId}
    └── {conducted, conductedAt, winners[]}
```

---

## 8. Phase 間の独立性（一番大事な結論）

| 変更 | events に新フィールド追加 (P1) | データパス変更 (P2) | 機能追加 (P3) |
|---|---|---|---|
| 既存データ互換 | ✅ 任意項目で破壊なし | 1回マイグレーションが必要 | ✅ 既存は触らない |
| 既存UIへの影響 | ✅ 新規UIブロックの追加のみ | チーム選択のラッパー追加 | ✅ 既存画面に部品追加 |
| 抽選ロジックへの影響 | ✅ なし | ✅ なし（パスだけ変わる） | ✅ なし |
| Phase 1 を先にやっても Phase 2/3 が困るか | — | **困らない** | **困らない** |

**結論**: Phase 1 は**完全に独立して実装可能**。後から Phase 2 / Phase 3 を追加しても Phase 1 で書いたコードを破棄する必要はない。

---

## 9. Phase 1 実装チェックリスト

- [ ] `events` データに6フィールドを追加（型定義・デフォルト値）
- [ ] AdminScreen 試合編集フォームに「試合要項」セクション追加（アコーディオンで折りたたみ可）
- [ ] HomeScreen 直近試合カードに要項表示を追加
- [ ] EventScreen に試合要項カード追加（参加登録の上）
- [ ] 会場名の下に「🗺 会場の地図を見る」「🅿️ 周辺の駐車場を探す」の2ボタンを実装（全員に表示・外部リンク）
- [ ] LINE共有テキスト生成の拡張（要項フィールドを自動追記）
- [ ] [index_dev.html](index_dev.html) で動作確認後、[index.html](index.html) にも反映

---

## 10. 設計上の禁則事項（ごちゃごちゃ化を防ぐ）

- ❌ チャット機能・アルバム機能・スコア記録 → 入れない（LINE / 専用アプリで十分）
- ❌ 試合詳細をすべてトップ画面に展開 → 折りたたみ・タップで表示
- ❌ 必須項目を増やす → すべて任意のまま
- ❌ Phase 1 の段階で他チーム配布を意識した過剰設計 → 自チームで使えるシンプル実装に留める
