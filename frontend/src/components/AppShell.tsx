"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Home, Map, Heart, Settings, Github, Coffee } from "lucide-react";

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
      className={`flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors ${
        isActive
          ? "text-white bg-white/[0.07]"
          : "text-[#475569] hover:text-[#94A3B8] hover:bg-white/[0.04]"
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
      {/* Desktop sidebar — 220px fixed */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-subtle bg-navy-950 fixed top-0 left-0 h-dvh z-50">
        <div className="px-4 pt-5 pb-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="animate-live-pulse w-1.5 h-1.5 rounded-full bg-status-green shrink-0" />
            <span className="font-display font-bold text-[18px] text-white tracking-tight">
              BorderPulse
            </span>
          </Link>
          <p className="text-[10px] text-[#334155] mt-1 pl-[22px]">
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
            className="flex items-center gap-2 text-xs text-[#334155] hover:text-[#475569] transition-colors"
          >
            <Github size={14} />
            {t("sourceOnGithub")}
          </a>
          <a
            href="https://buymeacoffee.com/lmbraca"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[#334155] hover:text-[#475569] transition-colors"
          >
            <Coffee size={14} />
            {t("buyMeACoffee")}
          </a>
        </div>
      </aside>

      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col min-h-dvh lg:ml-[220px] min-w-0">
        {children}
      </div>

      {/* Mobile bottom nav — floating pill */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-2 safe-pb">
        <div
          className="flex items-center justify-around rounded-pill border border-subtle backdrop-blur-2xl px-2 py-1.5"
          style={{
            background: "rgba(12,24,44,0.92)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {NAV_KEYS.map(({ href, icon: Icon, tKey }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-5 py-[5px] rounded-[14px] transition-colors ${
                isActive(href)
                  ? "text-white bg-white/[0.08]"
                  : "text-[#475569] hover:text-[#94A3B8]"
              }`}
            >
              <Icon size={18} strokeWidth={isActive(href) ? 2.2 : 1.5} />
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
