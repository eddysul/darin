import { useState, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, Eye, EyeOff, User, CheckCircle2, ChevronDown } from "lucide-react";
import { useLanguage } from "../LanguageContext";

type LoginScreenProps = {
  onLogin: () => void;
  onSignUp: () => void;
};

type AuthMode = "login" | "signup";

const NAVY = "#1A2333";
const GOLD = "#C4A574";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c3.398-3.127 5.684-7.735 5.684-13.216z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="white" aria-hidden="true">
      <path d="M14.94 9.54c-.02-2.17 1.77-3.21 1.85-3.27-1.01-1.47-2.58-1.67-3.13-1.7-1.33-.14-2.6.78-3.27.78-.68 0-1.72-.76-2.83-.74-1.46.02-2.8.85-3.55 2.15-1.52 2.63-.39 6.52 1.09 8.66.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.82-.7 1.32 0 1.69.7 2.84.68 1.17-.02 1.92-1.06 2.63-2.1.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.28-.87-2.3-3.47zM12.52 2.89c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.5 2.56-1.25z" />
    </svg>
  );
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const COUNTRY_OPTIONS = [
  { code: "+1", flag: "🇺🇸", label: "US", placeholder: "(555) 123-4567" },
  { code: "+82", flag: "🇰🇷", label: "KR", placeholder: "010-1234-5678" },
  { code: "+81", flag: "🇯🇵", label: "JP", placeholder: "090-1234-5678" },
  { code: "+44", flag: "🇬🇧", label: "UK", placeholder: "07123 456789" },
  { code: "+86", flag: "🇨🇳", label: "CN", placeholder: "138 0013 8000" },
] as const;

export function LoginScreen({ onLogin, onSignUp }: LoginScreenProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const isSignup = mode === "signup";
  const selectedCountry = COUNTRY_OPTIONS.find((c) => c.code === countryCode) ?? COUNTRY_OPTIONS[0];
  const fullPhoneNumber = `${countryCode} ${phone}`.trim();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const resetPhoneVerification = () => {
    setCountryCode("+1");
    setPhone("");
    setVerificationCode("");
    setSentCode(null);
    setPhoneVerified(false);
    setCodeSent(false);
    setCountdown(0);
  };

  const resetVerificationState = () => {
    setPhoneVerified(false);
    setCodeSent(false);
    setSentCode(null);
    setVerificationCode("");
    setCountdown(0);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFormError("");
    if (next === "login") resetPhoneVerification();
  };

  const handleSendCode = () => {
    if (!phone.trim()) {
      setFormError(t("signup.phoneRequired"));
      return;
    }
    const code = generateVerificationCode();
    setSentCode(code);
    setCodeSent(true);
    setPhoneVerified(false);
    setVerificationCode("");
    setCountdown(60);
    setFormError("");
  };

  const handleVerifyCode = () => {
    if (!verificationCode.trim()) {
      setFormError(t("signup.codeRequired"));
      return;
    }
    if (verificationCode === sentCode) {
      setPhoneVerified(true);
      setFormError("");
    } else {
      setFormError(t("signup.invalidCode"));
      setPhoneVerified(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    resetVerificationState();
  };

  const handleCountryChange = (code: string) => {
    setCountryCode(code);
    resetVerificationState();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isSignup) {
      if (!phone.trim()) {
        setFormError(t("signup.phoneRequired"));
        return;
      }
      if (!phoneVerified) {
        setFormError(t("signup.codeRequired"));
        return;
      }
      if (password !== confirmPassword) {
        setFormError(t("signup.passwordMismatch"));
        return;
      }
    }
    setFormError("");
    if (isSignup) {
      onSignUp();
    } else {
      onLogin();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-[55] flex flex-col bg-white px-7 pt-8 pb-8 overflow-y-auto"
    >
      <div className="flex flex-col items-center mb-5">
        <img
          src="/darin-logo.png"
          alt="Darin — The Moon, a Mother. The Star, a Baby."
          className="w-[200px] h-auto select-none"
          draggable={false}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mb-5"
        >
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: NAVY, fontFamily: "Nunito, sans-serif" }}
          >
            {isSignup ? t("signup.title") : t("login.title")}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isSignup ? t("signup.subtitle") : t("login.subtitle")}
          </p>
        </motion.div>
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold" style={{ color: NAVY }}>
              {t("signup.name")}
            </span>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("signup.namePlaceholder")}
                required
                className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </label>
        )}

        {isSignup && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold" style={{ color: NAVY }}>
              {t("signup.phone")} <span className="text-primary">*</span>
            </span>
            <div className="flex gap-2">
              <div className="relative shrink-0">
                <select
                  value={countryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  disabled={phoneVerified}
                  aria-label="Country code"
                  className="appearance-none bg-input-background rounded-xl pl-3 pr-8 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground disabled:opacity-60 min-w-[108px]"
                >
                  {COUNTRY_OPTIONS.map(({ code, flag, label }) => (
                    <option key={code} value={code}>
                      {flag} {code} {label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={selectedCountry.placeholder}
                required
                disabled={phoneVerified}
                className="flex-1 min-w-0 bg-input-background rounded-xl px-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground disabled:opacity-60"
              />
            </div>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={phoneVerified || countdown > 0 || !phone.trim()}
              className="w-full py-3 rounded-xl text-xs font-semibold border border-primary text-primary hover:bg-primary/5 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {countdown > 0
                ? t("signup.resendIn").replace("{seconds}", String(countdown))
                : codeSent
                  ? t("signup.resendCode")
                  : t("signup.sendCode")}
            </button>

            {codeSent && !phoneVerified && (
              <div className="flex flex-col gap-1.5 mt-1">
                <p className="text-xs text-green-600">
                  {t("signup.codeSent")} ({fullPhoneNumber})
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    placeholder={t("signup.verificationCodePlaceholder")}
                    className="flex-1 bg-input-background rounded-xl px-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    className="shrink-0 px-4 py-3 rounded-xl text-xs font-semibold bg-primary text-white hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
                  >
                    {t("signup.verifyCode")}
                  </button>
                </div>
                {sentCode && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Demo code: {sentCode}
                  </p>
                )}
              </div>
            )}

            {phoneVerified && (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={14} />
                {t("signup.phoneVerified")}
              </p>
            )}
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: NAVY }}>
            {t("login.email")}
          </span>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              required={isSignup}
              className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold" style={{ color: NAVY }}>
            {t("login.password")}
          </span>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.passwordPlaceholder")}
              required={isSignup}
              className="w-full bg-input-background rounded-xl pl-10 pr-11 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold" style={{ color: NAVY }}>
              {t("signup.confirmPassword")}
            </span>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("signup.confirmPasswordPlaceholder")}
                required
                className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </label>
        )}

        {formError && (
          <p className="text-xs text-red-500 font-medium -mt-1">{formError}</p>
        )}

        {!isSignup && (
          <button
            type="button"
            className="text-xs font-semibold text-right self-end hover:opacity-70 transition-opacity"
            style={{ color: GOLD }}
          >
            {t("login.forgotPassword")}
          </button>
        )}

        <button
          type="submit"
          disabled={isSignup && !phoneVerified}
          className="w-full bg-primary text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-primary/25 mt-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSignup ? t("signup.submit") : t("login.submit")}
        </button>

        {!isSignup && (
          <>
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{t("login.or")}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={isSignup ? onSignUp : onLogin}
                className="w-full flex items-center justify-center gap-3 border border-border bg-white text-foreground rounded-xl py-3.5 text-sm font-semibold hover:bg-secondary/40 active:scale-[0.98] transition-all"
              >
                <GoogleIcon />
                {t("login.continueGoogle")}
              </button>

              <button
                type="button"
                onClick={isSignup ? onSignUp : onLogin}
                className="w-full flex items-center justify-center gap-3 bg-[#1A2333] text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <AppleIcon />
                {t("login.continueApple")}
              </button>
            </div>
          </>
        )}
      </form>

      <p className="text-center text-sm text-muted-foreground mt-5">
        {isSignup ? t("signup.hasAccount") : t("login.noAccount")}{" "}
        <button
          type="button"
          onClick={() => switchMode(isSignup ? "login" : "signup")}
          className="font-semibold hover:opacity-70 transition-opacity underline underline-offset-2"
          style={{ color: NAVY }}
        >
          {isSignup ? t("signup.logIn") : t("login.signUp")}
        </button>
      </p>
    </motion.div>
  );
}
