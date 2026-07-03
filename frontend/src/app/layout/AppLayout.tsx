import { VersionWelcomeGate } from "@/features/welcome";
import { useAppInitialization, usePersistedState } from "@/shared/hooks";
import { cn, STORAGE_KEYS } from "@/shared/lib";
import { writeLastRoute } from "@/shared/lib/navigation";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  useAppInitialization();
  const location = useLocation();
  // const runHydration = useStore(s => s.runHydration)
  // const sessions = useStore(s => s.sessions)

  const [desktopOpen, setDesktopOpen] = usePersistedState<boolean>(
    STORAGE_KEYS.sidebarOpen,
    true,
  );

  // const showRunStatus = runHydration.loading && (runHydration.total > 0 || sessions.length > 0)
  // const runStatusLabel = runHydration.total > 0
  //   ? `Loading history ${Math.min(runHydration.loaded, runHydration.total)}/${runHydration.total}`
  //   : 'Loading history'

  useEffect(() => {
    writeLastRoute(location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex h-svh gap-2 bg-sidebar p-3 overflow-hidden">
      <div
        className={cn(
          "h-full shrink-0 transition-[width] duration-200 ease-out",
          desktopOpen ? "w-60" : "w-12",
        )}
      >
        <Sidebar
          open={desktopOpen}
          onToggle={() => setDesktopOpen((prev) => !prev)}
        />
      </div>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-canvas shadow">
        {/* {showRunStatus && (
          <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-full border border-primary/15 bg-canvas/90 px-3 py-1 text-xs text-surface-muted-foreground shadow-sm backdrop-blur">
            {runStatusLabel}
          </div>
        )} */}
        <div
          key={location.pathname}
          className="route-content-enter flex min-h-0 flex-1 flex-col"
        >
          <Outlet />
        </div>
      </main>

      <VersionWelcomeGate />
    </div>
  );
}
