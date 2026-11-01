import type { TabName } from "../lib/route";

const TABS: { name: TabName; emoji: string; label: string }[] = [
  { name: "home", emoji: "📅", label: "予定" },
  { name: "parking", emoji: "🚗", label: "駐車場抽選" },
  { name: "tournaments", emoji: "🏆", label: "大会・要項" },
];

export function TabNav({ current, onSelect }: { current: TabName; onSelect: (tab: TabName) => void }) {
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
            <span className="tab-emoji" aria-hidden="true">{tab.emoji}</span>
            <span>{tab.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
