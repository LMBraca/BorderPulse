"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import dynamic from "next/dynamic";

const BorderMap = dynamic(() => import("@/components/BorderMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full skeleton" />,
});

export default function MapPage() {
  const router = useRouter();
  const t = useTranslations("map");

  return (
    <div className="h-dvh flex flex-col relative">
      <header className="absolute top-0 left-0 right-0 z-[1000] px-4 lg:px-8 pt-4 pb-8 bg-gradient-to-b from-navy-950 to-transparent">
        <h1 className="font-display font-bold text-base text-white">
          {t("title")}
        </h1>
        <p className="text-[11px] text-slate-500 mt-0.5">{t("tapHint")}</p>
      </header>

      <div className="absolute top-16 right-3 lg:right-6 z-[1000] rounded-lg px-2.5 py-2 bg-navy-800/90 backdrop-blur-md border border-subtle">
        <div className="flex flex-col gap-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-green" />
            <span className="text-slate-400">{t("legendGreen")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-yellow" />
            <span className="text-slate-400">{t("legendYellow")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-red" />
            <span className="text-slate-400">{t("legendRed")}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-20 lg:pb-0">
        <BorderMap onMarkerClick={(id) => router.push(`/crossing/${id}`)} />
      </div>
    </div>
  );
}
