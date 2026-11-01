import { useCallback, useEffect, useState } from "react";

export type TabName = "home" | "parking" | "tournaments";
export type Route =
  | { name: TabName }
  | { name: "event"; id: string; from?: TabName }
  | { name: "tournament"; id: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** `#home` `#parking` `#tournaments` `#event/{id}` `#tournament/{id}` */
export function parseRoute(hash: string): Route {
  const [head = "", id = ""] = hash.replace(/^#\/?/, "").split("/");
  if (head === "home" || head === "parking" || head === "tournaments") return { name: head };
  if (head === "event" && ID.test(id)) return { name: "event", id };
  if (head === "tournament" && ID.test(id)) return { name: "tournament", id };
  return { name: "home" };
}

export function routeToHash(route: Route): string {
  return route.name === "event" || route.name === "tournament" ? `#${route.name}/${route.id}` : `#${route.name}`;
}

/** 詳細画面を開いているときに、どのタブを選択中として見せるか */
export function tabOf(route: Route): TabName {
  if (route.name === "event") return route.from ?? "home";
  if (route.name === "tournament") return "tournaments";
  return route.name;
}

type HistoryState = { mss: true; from?: TabName } | null;

export function useRoute() {
  const read = (): Route => {
    const route = parseRoute(window.location.hash);
    const state = window.history.state as HistoryState;
    return route.name === "event" && state?.from ? { ...route, from: state.from } : route;
  };
  const [route, setRoute] = useState<Route>(read);

  useEffect(() => {
    const sync = () => setRoute(read());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const navigate = useCallback((next: Route, options: { replace?: boolean } = {}) => {
    const state: HistoryState = { mss: true, ...(next.name === "event" && next.from ? { from: next.from } : {}) };
    const hash = routeToHash(next);
    if (options.replace) window.history.replaceState(state, "", hash);
    else window.history.pushState(state, "", hash);
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);

  /** アプリ内で開いた画面なら1つ戻る。LINE などから直接開いた場合は fallback へ */
  const back = useCallback((fallback: Route) => {
    if ((window.history.state as HistoryState)?.mss && window.history.length > 1) window.history.back();
    else navigate(fallback, { replace: true });
  }, [navigate]);

  return { route, navigate, back };
}
