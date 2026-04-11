import { Link, Outlet, useLocation } from "react-router-dom";

export default function AppLayout() {
  const location = useLocation();

  const nav = [
    { label: "Jobs", path: "/jobs" },
    { label: "Dashboard", path: location.pathname.match(/^\/jobs\/[^\/]+/) ? `${location.pathname.match(/^\/jobs\/[^\/]+/)[0]}/dashboard` : "/jobs" },
    { label: "Gantt", path: location.pathname.match(/^\/jobs\/[^\/]+/) ? `${location.pathname.match(/^\/jobs\/[^\/]+/)[0]}/gantt` : "/jobs" },
    { label: "Resources", path: location.pathname.match(/^\/jobs\/[^\/]+/) ? `${location.pathname.match(/^\/jobs\/[^\/]+/)[0]}/resources` : "/jobs" },
    { label: "Timesheets", path: "/timesheets" },
    { label: "Reports", path: "/reports" },
    { label: "Settings", path: "/settings" },
  ];

  return (
    <div className="flex h-screen">

      {/* SIDEBAR */}
      <div className="w-56 bg-slate-900 text-white flex flex-col">
        <div className="p-4 text-lg font-semibold border-b border-slate-700">
          FitoutOS
        </div>

        <div className="flex-1 p-2 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className={`block px-3 py-2 rounded text-sm ${
                location.pathname.startsWith(item.path)
                  ? "bg-slate-700"
                  : "hover:bg-slate-800"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </div>

    </div>
  );
}




