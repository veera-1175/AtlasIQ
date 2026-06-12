import { useState } from "react";
import { login, setAuthToken, UserProfile } from "../api";
import { AtlasLogo, IconBolt, IconChart, IconShield, IconSpark } from "./Icons";
import Snowfall from "./Snowfall";

interface LoginPageProps {
  onSuccess: (user: UserProfile) => void;
}

const FEATURES = [
  { Icon: IconShield, title: "Tenant Isolation", desc: "Company data stays private to your org" },
  { Icon: IconSpark, title: "Role-Based Access", desc: "Admins control table-level permissions" },
  { Icon: IconChart, title: "Auto Charts", desc: "Bar, line, pie from result topology" },
  { Icon: IconBolt, title: "Audit Trail", desc: "Every action logged for company admins" },
];

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const auth = await login(email.trim(), password);
      setAuthToken(auth.access_token);
      localStorage.setItem("atlasiq_email", auth.email);
      localStorage.setItem("atlasiq_role", auth.platform_role);
      onSuccess({
        id: "",
        email: auth.email,
        platform_role: auth.platform_role,
        company_id: auth.company_id,
        company_name: auth.company_name,
        can_upload: auth.platform_role === "company_admin",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-black">
      <div className="relative z-10 hidden w-[45%] flex-col justify-between overflow-hidden border-r border-ink-800 bg-black p-12 lg:flex">
        <div className="absolute inset-0 animate-grid-drift bg-grid-pattern bg-grid opacity-30" />
        <div className="relative flex items-center gap-3">
          <AtlasLogo className="h-10 w-10" />
          <span className="font-mono text-xs tracking-[0.3em] text-ink-500">ATLASIQ v1.0</span>
        </div>

        <div className="relative space-y-8">
          <h1 className="max-w-md text-6xl font-bold leading-[0.95] tracking-tight text-white xl:text-7xl">
            Intelligence<br />
            <span className="text-ink-200">for your data.</span>
          </h1>
          <p className="max-w-sm text-lg leading-relaxed text-ink-100">
            Multi-tenant analytics with company admins, employee RBAC, and confidential data isolation.
          </p>
        </div>

        <p className="relative font-mono text-xs text-ink-600">
          AtlasIQ Platform → Company Admin → Employees
        </p>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center bg-ink-950 px-6 py-12 sm:px-12 lg:px-16">
        <div className="relative z-10 mx-auto w-full max-w-md animate-fade-in-up">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <AtlasLogo className="h-9 w-9" />
            <span className="text-2xl font-bold text-white">AtlasIQ</span>
          </div>

          <p className="mono-label">Authentication</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Sign in</h2>
          <p className="mt-2 text-sm text-ink-500">Use credentials provided by AtlasIQ or your company admin</p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label className="mono-label mb-3 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input-ink" autoFocus />
            </div>

            <div>
              <label className="mono-label mb-3 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input-ink" />
            </div>

            {error && (
              <div className="animate-fade-in border border-ink-600 bg-ink-900 px-4 py-3 text-sm text-ink-200">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-ink w-full">
              {loading ? "Authenticating…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-label">Platform admin</span>
              <button type="button" onClick={() => { setEmail("admin@atlasiq.io"); setPassword("AtlasIQ@2026"); }} className="tag">
                admin@atlasiq.io
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-label">Demo company</span>
              <button type="button" onClick={() => { setEmail("admin@demo.acme.com"); setPassword("Demo@2026"); }} className="tag">
                Company admin
              </button>
              <button type="button" onClick={() => { setEmail("analyst@demo.acme.com"); setPassword("Demo@2026"); }} className="tag">
                Employee
              </button>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-3">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <div key={title} className="feature-card" style={{ animationDelay: `${i * 0.08}s` }}>
                <Icon />
                <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Snowfall />
    </div>
  );
}
