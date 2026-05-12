import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy – BorderPulse",
  description: "Privacy policy for the BorderPulse iOS & Android app.",
};

export default function PrivacyPage() {
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
        Privacy Policy
      </h1>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 40 }}>
        Effective date: April 15, 2026 &nbsp;|&nbsp; App: BorderPulse (iOS &amp; Android) &nbsp;|&nbsp;{" "}
        <a href="mailto:lmbdv50@gmail.com" style={{ color: "#3b82f6" }}>
          lmbdv50@gmail.com
        </a>
      </p>

      <p>
        BorderPulse is a mobile client for a public border wait-time API. The app has no user
        accounts, does not ask you to sign in, and does not collect anything you type. This policy
        describes the limited technical data we process so we can keep the app working.
      </p>

      <h2 style={h2}>What we collect</h2>

      <h3 style={h3}>1. Diagnostic data (Sentry)</h3>
      <p>
        When the app crashes or hits an unhandled error, we send a crash report to{" "}
        <a href="https://sentry.io" style={link}>
          Sentry
        </a>{" "}
        so we can fix it. A report contains:
      </p>
      <ul style={ul}>
        <li>The stack trace and error message</li>
        <li>App version, build number, and release channel</li>
        <li>Device model, OS name and version, and device locale</li>
        <li>A randomly generated install ID (not linked to you personally)</li>
        <li>
          Your IP address at the time of the report, which Sentry discards after geolocation — we
          do not store it
        </li>
      </ul>
      <p>We do <strong>not</strong> send screen content, form input, or any data you have entered.</p>

      <h3 style={h3}>2. Product analytics (PostHog)</h3>
      <p>
        We use{" "}
        <a href="https://posthog.com" style={link}>
          PostHog
        </a>{" "}
        (US region) to understand which screens and features are used. Events contain:
      </p>
      <ul style={ul}>
        <li>Screen name and anonymous event name (e.g. <code style={code}>$screen</code>, <code style={code}>map_viewed</code>)</li>
        <li>App version, device model, OS version, and locale</li>
        <li>A randomly generated anonymous ID stored on the device</li>
      </ul>
      <p>
        We do <strong>not</strong> track your real-world location, contacts, advertising ID, or any
        personally identifying information. Analytics are disabled in development builds.
      </p>

      <h3 style={h3}>3. API requests</h3>
      <p>
        The app fetches border wait-time data from our backend at{" "}
        <code style={code}>borderpulse-production.up.railway.app</code>. Standard server access
        logs (IP address, timestamp, requested endpoint) are retained for up to 14 days for abuse
        prevention and then deleted. The backend stores no per-user data.
      </p>

      <h2 style={h2}>What we do NOT collect</h2>
      <ul style={ul}>
        <li>Your name, email, phone number, or any account credentials (we have no accounts)</li>
        <li>Your precise or approximate geolocation — the app never requests location permission</li>
        <li>Your photos, contacts, calendar, microphone, or camera</li>
        <li>Any advertising identifier (IDFA / GAID)</li>
        <li>Health, financial, or payment information</li>
        <li>Content of anything you type or any files on your device</li>
      </ul>

      <h2 style={h2}>How we use this data</h2>
      <p>Only to:</p>
      <ol style={ul}>
        <li>Diagnose and fix crashes and bugs</li>
        <li>Understand which features are used so we can prioritize improvements</li>
        <li>Detect and block abuse of the public API</li>
      </ol>
      <p>
        We do <strong>not</strong> sell or rent data, and we do{" "}
        <strong>not</strong> share data with advertisers or data brokers.
      </p>

      <h2 style={h2}>Data sharing</h2>
      <p>Data is processed by:</p>
      <ul style={ul}>
        <li>
          <strong>Sentry</strong> (Functional Software, Inc.) — crash diagnostics.{" "}
          <a href="https://sentry.io/privacy/" style={link}>Sentry&apos;s privacy policy</a>.
        </li>
        <li>
          <strong>PostHog</strong> (PostHog Inc., US region) — product analytics.{" "}
          <a href="https://posthog.com/privacy" style={link}>PostHog&apos;s privacy policy</a>.
        </li>
        <li>
          <strong>Railway</strong> (Railway Corp.) — hosts the backend API that the app calls.
        </li>
      </ul>
      <p>These are &quot;sub-processors&quot; acting on our behalf. No other third parties receive data from the app.</p>

      <h2 style={h2}>Data retention</h2>
      <ul style={ul}>
        <li>Sentry crash reports: 90 days, then deleted automatically</li>
        <li>PostHog analytics events: 12 months, then deleted automatically</li>
        <li>Backend access logs: 14 days</li>
      </ul>

      <h2 style={h2}>Your choices</h2>
      <p>
        Because there is no account, there is nothing to log into or delete server-side that
        identifies you. To stop all analytics and crash reporting from your device, uninstall the
        app.
      </p>
      <p>
        If you believe a specific anonymous ID is yours and want it deleted from our analytics,
        email{" "}
        <a href="mailto:lmbdv50@gmail.com" style={link}>
          lmbdv50@gmail.com
        </a>{" "}
        with the ID (Settings → About in the app) and we will remove it within 30 days.
      </p>

      <h2 style={h2}>Children</h2>
      <p>
        BorderPulse is not directed to children under 13. We do not knowingly collect data from
        children. If you believe a child has used the app and want associated anonymous analytics
        removed, contact us.
      </p>

      <h2 style={h2}>International users</h2>
      <p>Data is processed in the United States. By using the app you consent to this processing.</p>

      <h2 style={h2}>Changes</h2>
      <p>
        If we materially change what we collect, we will update the &quot;Effective date&quot; above and
        note the change in the app&apos;s release notes.
      </p>

      <h2 style={h2}>Contact</h2>
      <p>
        Questions:{" "}
        <a href="mailto:lmbdv50@gmail.com" style={link}>
          lmbdv50@gmail.com
        </a>
      </p>

      <p style={{ marginTop: 60, fontSize: 12, color: "#334155" }}>
        © 2026 BorderPulse
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

const ul: React.CSSProperties = {
  paddingLeft: 22,
  marginBottom: 12,
};

const link: React.CSSProperties = {
  color: "#3b82f6",
  textDecoration: "none",
};

const code: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 13,
  backgroundColor: "#0f172a",
  padding: "1px 5px",
  borderRadius: 4,
};
