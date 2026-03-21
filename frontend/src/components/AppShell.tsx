"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Home, Map, Heart, Settings, Radio, Github, Coffee } from "lucide-react";

const NAV_KEYS = [
  { href: "/", icon: Home, tKey: "home" },
  { href: "/map", icon: Map, tKey: "map" },
  { href: "/favorites", icon: Heart, tKey: "saved" },
  { href: "/settings", icon: Settings, tKey: "settings" },
] as const;

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? "text-white bg-white/[0.06]"
          : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
      }`}
    >
      <Icon size={18} strokeWidth={isActive ? 2.2 : 1.5} />
      <span className="text-sm font-medium font-display">{label}</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-subtle bg-navy-950 fixed top-0 left-0 h-dvh z-50">
        <div className="px-4 pt-5 pb-6">
          <Link href="/" className="flex items-center gap-2">
            <Radio size={18} className="text-blue-400" />
            <span className="font-display font-bold text-base text-white tracking-tight">
              BorderPulse
            </span>
          </Link>
          <p className="text-[10px] text-slate-600 mt-1 pl-[26px]">
            {t("home") === "Inicio" ? "Tiempos de espera en la frontera" : "Live border wait times"}
          </p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_KEYS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t(item.tKey)}
              isActive={isActive(item.href)}
            />
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-subtle space-y-2">
          <a
            href="https://github.com/LMBraca/BorderPulse"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            <Github size={14} />
            {t("sourceOnGithub")}
          </a>
          <a
            href="https://buymeacoffee.com/lmbraca"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            <Coffee size={14} />
            {t("buyMeACoffee")}
          </a>
        </div>
      </aside>

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col min-h-dvh lg:ml-56 min-w-0">
        {children}
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2">
        <div className="flex items-center justify-around rounded-2xl border border-subtle bg-navy-800/90 backdrop-blur-xl px-2 py-1.5 shadow-lg shadow-black/30">
          {NAV_KEYS.map(({ href, icon: Icon, tKey }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
                isActive(href)
                  ? "text-white bg-white/[0.06]"
                  : "text-slate-500 hover:text-slate-400"
              }`}
            >
              <Icon size={19} strokeWidth={isActive(href) ? 2.2 : 1.5} />
              <span className="text-[10px] font-display font-medium">
                {t(tKey)}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
