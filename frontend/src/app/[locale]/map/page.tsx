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
      <header
        className="absolute top-0 left-0 right-0 z-[1000] px-4 lg:px-8 pt-4 pb-8"
        style={{ background: "linear-gradient(to bottom, #060E1A, transparent)" }}
      >
        <h1 className="font-display font-bold text-[18px] text-[#F1F5F9]" style={{ letterSpacing: -0.4 }}>
          {t("title")}
        </h1>
        <p className="text-[11px] text-[#475569] mt-0.5">{t("tapHint")}</p>
      </header>

      <div
        className="absolute top-16 right-3 lg:right-6 z-[1000] px-2.5 py-2 backdrop-blur-md"
        style={{ background: "rgba(12,27,48,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10 }}
      >
        <div className="flex flex-col gap-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "oklch(72% 0.14 148)" }} />
            <span className="text-[#475569]">{t("legendGreen")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "oklch(78% 0.14 68)" }} />
            <span className="text-[#475569]">{t("legendYellow")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "oklch(65% 0.17 25)" }} />
            <span className="text-[#475569]">{t("legendRed")}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 pb-20 lg:pb-0">
        <BorderMap onMarkerClick={(id) => router.push(`/crossing/${id}`)} />
      </div>
    </div>
  );
}
