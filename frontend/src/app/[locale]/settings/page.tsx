"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Info, Globe, Github, Coffee, Car, Languages, MessageCircle, CheckCircle } from "lucide-react";
import { BORDER_TIMEZONES, getUserTimezone, setUserTimezone } from "@/lib/timezone";
import { LANE_CODES, getPreferredLane, setPreferredLane, type LaneCode } from "@/lib/preferences";

type FeedbackType = "bug" | "feature" | "other";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tf = useTranslations("feedback");
  const tl = useTranslations("lanes.full");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [tz, setTz] = useState("America/Tijuana");
  const [lane, setLane] = useState<LaneCode>("standard_vehicle");

  const [fbType, setFbType] = useState<FeedbackType>("bug");
  const [fbMessage, setFbMessage] = useState("");
  const [fbStatus, setFbStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [fbHoneypot, setFbHoneypot] = useState("");
  const [fbLoadTime] = useState(() => Date.now());

  useEffect(() => {
    setTz(getUserTimezone());
    setLane(getPreferredLane());
  }, []);

  const handleFeedbackSubmit = async () => {
    if (!fbMessage.trim()) return;
    setFbStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: fbType, message: fbMessage.trim(), website: fbHoneypot, _t: fbLoadTime }),
      });
      if (!res.ok) throw new Error();
      setFbStatus("success");
      setFbMessage("");
      setTimeout(() => setFbStatus("idle"), 3000);
    } catch {
      setFbStatus("error");
    }
  };

  const handleTzChange = (value: string) => {
    setTz(value);
    setUserTimezone(value);
  };

  const handleLanguageChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as "en" | "es" });
  };

  return (
    <div className="min-h-dvh pb-24 lg:pb-0">
      <header className="px-4 lg:px-8 pt-6 pb-4">
        <div className="max-w-lg mx-auto lg:mx-0">
          <h1 className="font-display font-bold text-lg text-white">{t("title")}</h1>
        </div>
      </header>

      <main className="px-4 lg:px-8">
        <div className="max-w-lg mx-auto lg:mx-0 space-y-3">
          {/* Language */}
          <div className="rounded-xl bg-card border border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <Languages size={18} className="text-slate-400" />
              <div>
                <h3 className="font-display font-semibold text-sm text-white">{t("language")}</h3>
                <p className="text-xs text-slate-600 mt-0.5">{t("languageDesc")}</p>
              </div>
            </div>
            <select
              value={locale}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-subtle text-white focus:outline-none focus:border-slate-600 transition-colors"
            >
              <option value="en" className="bg-navy-800">English</option>
              <option value="es" className="bg-navy-800">Español</option>
            </select>
          </div>

          {/* Timezone */}
          <div className="rounded-xl bg-card border border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <Globe size={18} className="text-slate-400" />
              <div>
                <h3 className="font-display font-semibold text-sm text-white">{t("timezone")}</h3>
                <p className="text-xs text-slate-600 mt-0.5">{t("timezoneDesc")}</p>
              </div>
            </div>
            <select
              value={tz}
              onChange={(e) => handleTzChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-subtle text-white focus:outline-none focus:border-slate-600 transition-colors"
            >
              {BORDER_TIMEZONES.map((t) => (
                <option key={t.value} value={t.value} className="bg-navy-800">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preferred crossing type */}
          <div className="rounded-xl bg-card border border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <Car size={18} className="text-slate-400" />
              <div>
                <h3 className="font-display font-semibold text-sm text-white">{t("crossingType")}</h3>
                <p className="text-xs text-slate-600 mt-0.5">{t("crossingTypeDesc")}</p>
              </div>
            </div>
            <select
              value={lane}
              onChange={(e) => {
                const v = e.target.value as LaneCode;
                setLane(v);
                setPreferredLane(v);
              }}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-subtle text-white focus:outline-none focus:border-slate-600 transition-colors"
            >
              {LANE_CODES.map((code) => (
                <option key={code} value={code} className="bg-navy-800">
                  {tl(code)}
                </option>
              ))}
            </select>
          </div>

          {/* Feedback */}
          <div className="rounded-xl bg-card border border-subtle p-4">
            <div className="flex items-center gap-3 mb-1">
              <MessageCircle size={18} className="text-slate-400" />
              <div>
                <h3 className="font-display font-semibold text-sm text-white">{tf("title")}</h3>
                <p className="text-xs text-slate-600 mt-0.5">{tf("description")}</p>
              </div>
            </div>

            <div className="flex gap-1.5 my-3">
              {(["bug", "feature", "other"] as FeedbackType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setFbType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    fbType === type
                      ? "bg-white/[0.08] text-white border-white/[0.1]"
                      : "text-slate-500 border-transparent hover:text-slate-400"
                  }`}
                >
                  {tf(type)}
                </button>
              ))}
            </div>

            {/* Honeypot */}
            <input
              type="text"
              name="website"
              value={fbHoneypot}
              onChange={(e) => setFbHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
            />

            <textarea
              value={fbMessage}
              onChange={(e) => {
                setFbMessage(e.target.value);
                if (fbStatus === "error") setFbStatus("idle");
              }}
              placeholder={tf("placeholder")}
              maxLength={1000}
              rows={4}
              disabled={fbStatus === "sending" || fbStatus === "success"}
              className="w-full px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-subtle text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-600 transition-colors resize-none disabled:opacity-50"
            />

            <div className="flex items-center justify-between mt-2">
              <div className="text-xs">
                {fbStatus === "success" && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle size={14} />
                    {tf("success")}
                  </span>
                )}
                {fbStatus === "error" && (
                  <span className="text-red-400">{tf("error")}</span>
                )}
              </div>
              <button
                onClick={handleFeedbackSubmit}
                disabled={fbStatus === "sending" || fbStatus === "success" || !fbMessage.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {fbStatus === "sending" ? tf("sending") : tf("submit")}
              </button>
            </div>
          </div>

          {/* About */}
          <div className="rounded-xl bg-card border border-subtle p-4">
            <div className="flex items-center gap-3 mb-3">
              <Info size={18} className="text-slate-400" />
              <h3 className="font-display font-semibold text-sm text-white">{t("about")}</h3>
            </div>
            <div className="text-sm text-slate-500 leading-relaxed space-y-2">
              <p>{t("aboutText1")}</p>
              <p>{t("aboutText2")}</p>
            </div>
            <div className="flex gap-3 mt-4 pt-3 border-t border-subtle">
              <a
                href="https://github.com/LMBraca/BorderPulse"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Github size={14} />
                GitHub
              </a>
              <a
                href="https://buymeacoffee.com/lmbraca"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Coffee size={14} />
                Buy me a coffee
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
