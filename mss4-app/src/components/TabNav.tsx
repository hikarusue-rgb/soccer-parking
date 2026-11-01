import type { TabName } from "../lib/route";

const TABS: { name: TabName; emoji: string; label: string }[] = [
  { name: "home", emoji: "📅", label: "予定" },
  { name: "parking", emoji: "🚗", label: "駐車場" },
  { name: "tournaments", emoji: "📄", label: "大会・要項" },
];

/** スマホでは画面下に固定（親指で届く位置）、PCでは上に表示。counts は受付中の抽選などの件数 */
export function TabNav({ current, counts = {}, onSelect }: { current: TabName; counts?: Partial<Record<TabName, number>>; onSelect: (tab: TabName) => void }) {
  return (
    <nav className="tabs" aria-label="画面の切り替え">
      <div className="tabs-inner">
        {TABS.map((tab) => (
          <a
            key={tab.name}
            href={`#${tab.name}`}
            className="tab"
            aria-current={current === tab.name ? "page" : undefined}
            onClick={(e) => { e.preventDefault(); onSelect(tab.name); }}
          >
            <span className="tab-emoji" aria-hidden="true">{tab.emoji}{counts[tab.name] ? <span className="tab-count">{counts[tab.name]}</span> : null}</span>
            <span>{tab.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
