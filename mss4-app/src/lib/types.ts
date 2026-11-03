// Realtime Database `/mss/{grade}` のデータ型（画面で使う形）

export type EventKind = "practice" | "match" | "notice";
export type EventStatus = "scheduled" | "changed" | "canceled" | "postponed" | "unconfirmed";

export const KIND_LABELS: Record<EventKind, string> = { practice: "練習", match: "試合", notice: "連絡・休み" };
export const STATUS_LABELS: Record<EventStatus, string> = {
  scheduled: "予定どおり", changed: "変更あり", canceled: "中止", postponed: "延期", unconfirmed: "要確認",
};

/** アップロードした画像・PDF */
export interface Attachment {
  id: string;
  label: string;
  type: "image" | "pdf";
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  /** Storage 上の場所 */
  path: string;
  url: string;
  order: number;
  uploadedAt: number;
}

export interface ParkingSettings {
  mode: "none" | "lottery";
  /** 駐車可能台数 */
  limit: number;
  /** 応募締切（ミリ秒） */
  deadlineAt: number | null;
  /** 抽選外枠の台数（審判・コーチなど。誰が使うかはアプリでは決めない）。駐車可能台数 limit に含む */
  reserved: number;
  /** 以前の「確定枠」（抽選対象外のメンバーID）。過去の予定の表示用に残す */
  confirmed: string[];
}

/** 試合要項の構造化テキスト */
export interface EventDetails {
  format: string;
  referee: string;
  venueNotes: string;
}

export interface Uniform {
  top: string;
  bottom: string;
  socks: string;
}

export interface TeamEvent {
  id: string;
  date: string;
  kind: EventKind;
  title: string;
  status: EventStatus;
  start: string | null;
  end: string | null;
  meeting: string | null;
  kickoff: string | null;
  venue: string;
  opponent: string;
  uniform: Uniform;
  equipment: string[];
  equipmentConfirmed: boolean;
  messages: string[];
  note: string;
  tournamentId: string | null;
  details: EventDetails;
  attachments: Attachment[];
  parking: ParkingSettings;
  version: number;
  createdAt: number | null;
  updatedAt: number;
  updatedBy: string;
  legacy: { calendarId?: string; parkingEventId?: string } | null;
  /** クラブHPの予定表とのひも付け（GAS の自動反映が書く。アプリでは表示と保持だけ） */
  hp: HpLink | null;
}

/** クラブHPから自動反映した内容（前回入れた値。コーチが直した項目を上書きしないために使う） */
export interface HpLink {
  key: string;
  date?: string;
  title?: string;
  venue?: string;
  kind?: string;
  start?: string;
  end?: string;
  /** HPの補足（例：給食室側駐車場使用不可） */
  note?: string;
  text?: string;
  /** HPの予定表から消えている */
  removed?: boolean;
  prevStatus?: string;
}

export interface Member {
  id: string;
  num: number;
  name: string;
  active: boolean;
  order: number;
}

/** 車出しエントリー */
export interface Entry {
  attending: boolean;
  parkingNeeded: boolean;
  /** 乗合可能人数 */
  carpoolCapacity: number;
  at: number;
}

export type LotteryReason = "initial" | "cancel" | "limit_up" | "limit_down";

export interface LotteryRound {
  round: number;
  at: number;
  reason: LotteryReason;
  participants: string[];
  winners: string[];
}

/** 直近の抽選のあみだくじ（保護者もあとから再生できるように保存する） */
export interface LotteryLadder {
  /** 列の並び（メンバーID）。毎回ランダムに並べてから線を引く */
  order: string[];
  rows: number;
  rungs: number[][];
  /** 当たり枠の数（左から） */
  slots: number;
}

/** 抽選結果（＝当選履歴） */
export interface Lottery {
  status: "drawn";
  policy: "random";
  slots: number;
  participants: string[];
  winners: string[];
  rounds: LotteryRound[];
  conductedAt: number;
  updatedAt: number;
  ladder?: LotteryLadder | null;
}

export interface TeamMeta {
  team: string;
  gradeLabel: string;
  schema: number;
}

export interface TeamSettings {
  seasonStart: string;
  venues: string[];
  uniformColors: string[];
}

export interface TeamData {
  meta: TeamMeta;
  settings: TeamSettings;
  events: TeamEvent[];
  members: Member[];
  entries: Record<string, Record<string, Entry>>;
  lotteries: Record<string, Lottery>;
}
