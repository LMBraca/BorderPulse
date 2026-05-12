"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Info, Globe, Github, Coffee, Car, Languages, MessageCircle, CheckCircle, Thermometer } from "lucide-react";
import { BORDER_TIMEZONES, getUserTimezone, setUserTimezone } from "@/lib/timezone";
import {
  LANE_CODES,
  getPreferredLane,
  setPreferredLane,
  getTemperatureUnit,
  setTemperatureUnit,
  type LaneCode,
  type TemperatureUnit,
} from "@/lib/preferences";

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
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>("fahrenheit");

  const [fbType, setFbType] = useState<FeedbackType>("bug");
  const [fbMessage, setFbMessage] = useState("");
  const [fbStatus, setFbStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [fbHoneypot, setFbHoneypot] = useState("");
  const [fbLoadTime] = useState(() => Date.now());

  useEffect(() => {
    setTz(getUserTimezone());
    setLane(getPreferredLane());
    setTempUnit(getTemperatureUnit());
  }, []);

  const handleTempUnitChange = (value: TemperatureUnit) => {
    setTempUnit(value);
    setTemperatureUnit(value);
  };

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

  const selectClass = "w-full px-3 py-2 rounded-lg text-sm text-[#94A3B8] focus:outline-none transition-colors";
  const selectStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)" };
  const groupCardStyle = { background: "#0C1B30", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" as const };
  const itemStyle = { padding: "13px 18px", display: "flex" as const, alignItems: "center" as const, justifyContent: "space-between" as const };
  const itemBorder = { borderBottom: "1px solid rgba(255,255,255,0.04)" };

  return (
    <div className="flex flex-col min-h-dvh pb-[110px] lg:pb-10">
      <header
        className="sticky top-0 z-40 border-b border-subtle"
        style={{ background: "rgba(6,14,26,0.96)", backdropFilter: "blur(16px)", padding: "14px 16px" }}
      >
        <div className="max-w-lg mx-auto lg:mx-0">
          <h1 className="font-display font-bold text-[18px] text-[#F1F5F9]" style={{ letterSpacing: -0.4 }}>
            {t("title")}
          </h1>
        </div>
      </header>

      <main className="flex-1 px-4 lg:px-8 pt-3">
        <div className="max-w-[560px] mx-auto space-y-5">
          {/* Preferences group */}
          <div>
            <p className="text-[10px] font-bold text-[#334155] uppercase mb-2 pl-0.5" style={{ letterSpacing: 1.2 }}>
              {t("preferencesGroup") ?? "Preferences"}
            </p>
            <div style={groupCardStyle}>
              <div style={{ ...itemStyle, ...itemBorder }}>
                <span className="text-sm text-[#94A3B8] flex items-center gap-2.5">
                  <Languages size={16} className="text-[#475569]" /> {t("language")}
                </span>
                <select value={locale} onChange={(e) => handleLanguageChange(e.target.value)} className={selectClass} style={{ ...selectStyle, width: "auto" }}>
                  <option value="en" className="bg-navy-800">English</option>
                  <option value="es" className="bg-navy-800">Español</option>
                </select>
              </div>
              <div style={{ ...itemStyle, ...itemBorder }}>
                <span className="text-sm text-[#94A3B8] flex items-center gap-2.5">
                  <Car size={16} className="text-[#475569]" /> {t("crossingType")}
                </span>
                <select
                  value={lane}
                  onChange={(e) => { const v = e.target.value as LaneCode; setLane(v); setPreferredLane(v); }}
                  className={selectClass}
                  style={{ ...selectStyle, width: "auto" }}
                >
                  {LANE_CODES.map((code) => (
                    <option key={code} value={code} className="bg-navy-800">{tl(code)}</option>
                  ))}
                </select>
              </div>
              <div style={itemStyle}>
                <span className="text-sm text-[#94A3B8] flex items-center gap-2.5">
                  <Thermometer size={16} className="text-[#475569]" /> {t("temperatureUnit")}
                </span>
                <select value={tempUnit} onChange={(e) => handleTempUnitChange(e.target.value as TemperatureUnit)} className={selectClass} style={{ ...selectStyle, width: "auto" }}>
                  <option value="fahrenheit" className="bg-navy-800">°F</option>
                  <option value="celsius" className="bg-navy-800">°C</option>
                </select>
              </div>
            </div>
          </div>

          {/* Display group */}
          <div>
            <p className="text-[10px] font-bold text-[#334155] uppercase mb-2 pl-0.5" style={{ letterSpacing: 1.2 }}>
              {t("displayGroup") ?? "Display"}
            </p>
            <div style={groupCardStyle}>
              <div style={itemStyle}>
                <span className="text-sm text-[#94A3B8] flex items-center gap-2.5">
                  <Globe size={16} className="text-[#475569]" /> {t("timezone")}
                </span>
                <select value={tz} onChange={(e) => handleTzChange(e.target.value)} className={selectClass} style={{ ...selectStyle, width: "auto" }}>
                  {BORDER_TIMEZONES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-navy-800">{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Feedback group */}
          <div>
            <p className="text-[10px] font-bold text-[#334155] uppercase mb-2 pl-0.5" style={{ letterSpacing: 1.2 }}>
              {tf("title")}
            </p>
            <div style={groupCardStyle}>
              <div style={{ padding: "13px 18px" }}>
                <p className="text-xs text-[#475569] mb-3">{tf("description")}</p>
                <div className="flex gap-1.5 mb-3">
                  {(["bug", "feature", "other"] as FeedbackType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFbType(type)}
                      className="px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        border: `1px solid ${fbType === type ? "rgba(255,255,255,0.1)" : "transparent"}`,
                        borderRadius: 8,
                        background: fbType === type ? "rgba(255,255,255,0.08)" : "transparent",
                        color: fbType === type ? "#F1F5F9" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {tf(type)}
                    </button>
                  ))}
                </div>
                <input type="text" name="website" value={fbHoneypot} onChange={(e) => setFbHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none" />
                <textarea
                  value={fbMessage}
                  onChange={(e) => { setFbMessage(e.target.value); if (fbStatus === "error") setFbStatus("idle"); }}
                  placeholder={tf("placeholder")}
                  maxLength={1000}
                  rows={4}
                  disabled={fbStatus === "sending" || fbStatus === "success"}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder:text-[#334155] focus:outline-none resize-none disabled:opacity-50"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs">
                    {fbStatus === "success" && <span className="flex items-center gap-1" style={{ color: "oklch(72% 0.14 148)" }}><CheckCircle size={14} />{tf("success")}</span>}
                    {fbStatus === "error" && <span style={{ color: "oklch(65% 0.17 25)" }}>{tf("error")}</span>}
                  </div>
                  <button
                    onClick={handleFeedbackSubmit}
                    disabled={fbStatus === "sending" || fbStatus === "success" || !fbMessage.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#94A3B8", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {fbStatus === "sending" ? tf("sending") : tf("submit")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* About group */}
          <div>
            <p className="text-[10px] font-bold text-[#334155] uppercase mb-2 pl-0.5" style={{ letterSpacing: 1.2 }}>
              {t("about")}
            </p>
            <div style={groupCardStyle}>
              <div style={{ ...itemStyle, ...itemBorder }}>
                <span className="text-sm text-[#94A3B8]">{t("aboutText1")}</span>
              </div>
              <div style={itemStyle}>
                <span className="text-sm text-[#94A3B8]">Version</span>
                <span className="text-[13px] text-[#334155]">1.0.0</span>
              </div>
            </div>
          </div>

          {/* Footer links */}
          <div className="flex gap-5 justify-center py-2">
            <a href="https://github.com/LMBraca/BorderPulse" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#334155] hover:text-[#475569] transition-colors">
              <Github size={13} /> GitHub ↗
            </a>
            <a href="https://buymeacoffee.com/lmbraca" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#334155] hover:text-[#475569] transition-colors">
              <Coffee size={13} /> Buy me a coffee ↗
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
