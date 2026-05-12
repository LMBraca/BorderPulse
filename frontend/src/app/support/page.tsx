import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support – BorderPulse",
  description: "Get help with BorderPulse, the real-time US-Mexico border wait time app.",
};

export default function SupportPage() {
  return (
    <main
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px 80px",
        color: "#e2e8f0",
        backgroundColor: "#060e1a",
        minHeight: "100vh",
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: "#f1f5f9" }}>
        BorderPulse Support
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 40 }}>
        Real-time US–Mexico border crossing wait times
      </p>

      <p>
        BorderPulse shows live wait times for US–Mexico land border crossings, pulled straight from
        CBP&apos;s public data. No account needed — just open and check.
      </p>

      <h2 style={h2}>Frequently asked questions</h2>

      <h3 style={h3}>How current is the wait-time data?</h3>
      <p>
        Data comes from the U.S. Customs and Border Protection (CBP) public API, which updates
        approximately every 15–30 minutes. BorderPulse refreshes automatically when you open the
        app or pull to refresh.
      </p>

      <h3 style={h3}>The map is not loading — what should I do?</h3>
      <p>
        Make sure you have a data or Wi-Fi connection. If the map stays blank, force-close the app
        and reopen it. If the issue persists, let us know at{" "}
        <a href="mailto:lmbdv50@gmail.com" style={link}>
          lmbdv50@gmail.com
        </a>
        .
      </p>

      <h3 style={h3}>How do I add a crossing to Favorites?</h3>
      <p>
        Tap the heart icon on any crossing card in the main list or on the crossing detail page.
        Your favorites are saved on your device and sync instantly.
      </p>

      <h3 style={h3}>Can I change the temperature unit?</h3>
      <p>
        Yes — go to <strong>Settings</strong> and toggle between Celsius and Fahrenheit under
        &quot;Temperature Unit.&quot;
      </p>

      <h3 style={h3}>What does the app do with my data?</h3>
      <p>
        Very little. No account, no sign-in, no location access. We collect only anonymous crash
        reports (Sentry) and anonymous usage analytics (PostHog). See our{" "}
        <a href="/privacy" style={link}>
          Privacy Policy
        </a>{" "}
        for full details.
      </p>

      <h3 style={h3}>A crossing I need isn&apos;t listed</h3>
      <p>
        BorderPulse shows all crossings available in CBP&apos;s public dataset. If a crossing is
        missing, it may not yet be included in CBP&apos;s feed. Email us and we&apos;ll investigate.
      </p>

      <h2 style={h2}>Contact us</h2>
      <p>
        For bug reports, feature requests, or any other questions, email{" "}
        <a href="mailto:lmbdv50@gmail.com" style={link}>
          lmbdv50@gmail.com
        </a>
        . We typically respond within a few days.
      </p>

      <h2 style={h2}>Open source</h2>
      <p>
        BorderPulse is open source.{" "}
        <a href="https://github.com/LMBraca/BorderPulse" style={link}>
          View the project on GitHub
        </a>
        .
      </p>

      <h2 style={h2}>Support the project</h2>
      <p>
        BorderPulse is free with no ads. If you find it useful, you can{" "}
        <a href="https://buymeacoffee.com/lmbraca" style={link}>
          buy me a coffee
        </a>
        .
      </p>

      <p style={{ marginTop: 60, fontSize: 12, color: "#334155" }}>
        © 2026 BorderPulse &nbsp;|&nbsp;{" "}
        <a href="/privacy" style={{ color: "#475569", textDecoration: "none" }}>
          Privacy Policy
        </a>
      </p>
    </main>
  );
}

const h2: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginTop: 40,
  marginBottom: 10,
  color: "#f1f5f9",
  borderBottom: "1px solid #1e293b",
  paddingBottom: 8,
};

const h3: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginTop: 24,
  marginBottom: 8,
  color: "#cbd5e1",
};

const link: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
};
