import { useEffect, useMemo, useState } from "react";
import { CONFIG_ERROR, TARGET } from "./lib/config";
import { GRADE_LABELS, parseGrade, type GradeCode, type Role } from "./lib/grade";
import { tabOf, useRoute } from "./lib/route";
import { logOut, useSession } from "./lib/session";
import { hasParking } from "./lib/matches";
import { useTeamData } from "./lib/teamData";
import { TeamProvider } from "./lib/teamContext";
import { AppHeader } from "./components/AppHeader";
import { CoachLogin } from "./components/LoginScreen";
import { ChangePassphrase } from "./components/ChangePassphrase";
import { TabNav } from "./components/TabNav";
import { HomeView } from "./views/HomeView";
import { ParkingView } from "./views/ParkingView";
import { DocsView } from "./views/DocsView";
import { EventDetailView } from "./views/EventDetailView";

export default function App() {
  const grade = useMemo(() => parseGrade(window.location.search), []);
  const session = useSession(grade);

  useEffect(() => {
    document.title = `MSS・香澄 ${GRADE_LABELS[grade]}`;
  }, [grade]);

  if (CONFIG_ERROR) return <Message title="準備中です" body={CONFIG_ERROR} />;
  if (session.status === "loading") return <Splash />;
  // 閲覧は合言葉なし。コーチの合言葉でログインした端末だけ編集できる
  return <Shell grade={grade} role={session.role} />;
}

function Shell({ grade, role }: { grade: GradeCode; role: Role }) {
  const { route, navigate, back } = useRoute();
  const { data, error } = useTeamData(grade);
  const [coachLogin, setCoachLogin] = useState(false);
  const [changingPassphrase, setChangingPassphrase] = useState(false);
  const coach = role === "coach";
  // 下のタブに出す件数：締切前で受付中の駐車場抽選
  const counts = useMemo(() => {
    if (!data) return {};
    const now = Date.now();
    const open = data.events.filter((e) => hasParking(e) && !data.lotteries[e.id] && (e.parking.deadlineAt === null || now < e.parking.deadlineAt) && e.status !== "canceled");
    return { parking: open.length };
  }, [data]);

  // コーチとしてログインできたらダイアログを閉じる
  useEffect(() => {
    if (coach) setCoachLogin(false);
  }, [coach]);

  let view: React.ReactNode = null;
  switch (route.name) {
    case "home": view = <HomeView />; break;
    case "parking": view = <ParkingView />; break;
    case "tournaments": view = <DocsView />; break;
    case "event": view = <EventDetailView key={route.id} id={route.id} section={route.section} from={route.from} onBack={() => back({ name: route.from ?? "home" })} />; break;
  }

  return (
    <div className="app">
      <AppHeader grade={grade} role={role} onCoachLogin={() => setCoachLogin(true)} onChangePassphrase={() => setChangingPassphrase(true)} onLogout={() => void logOut()} />
      <TabNav current={tabOf(route)} counts={counts} onSelect={(tab) => navigate({ name: tab })} />
      <main className="main" id="main">
        {TARGET === "emulator" && <p className="dev-banner">開発用（ローカルのテスト環境）</p>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {!data && !error && <p className="loading" aria-busy="true">読み込んでいます…</p>}
        {data && (
          <TeamProvider grade={grade} role={role} data={data} navigate={navigate}>
            {view}
          </TeamProvider>
        )}
      </main>
      {coachLogin && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setCoachLogin(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-label="コーチとしてログイン" onClick={(e) => e.stopPropagation()}>
            <CoachLogin grade={grade} onCancel={() => setCoachLogin(false)} />
          </div>
        </div>
      )}
      {changingPassphrase && coach && (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-label="コーチの合言葉を変更">
            <ChangePassphrase onClose={() => setChangingPassphrase(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <div className="brand-mark" aria-hidden="true">M</div>
      <p>読み込んでいます…</p>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="splash">
      <h1>{title}</h1>
      <p>{body}</p>
    </div>
  );
}
