import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Baby,
  HeartHandshake,
  ChevronLeft,
  User,
  MapPin,
  Calendar,
  Globe,
  Briefcase,
  Sparkles,
  IdCard,
  Camera,
  Plus,
  Trash2,
  FileText,
} from "lucide-react";
import { useLanguage } from "../LanguageContext";
import type { CaregiverCertificate, UserProfile, UserRole } from "../types/profile";

type OnboardingScreenProps = {
  onComplete: (profile: UserProfile) => void;
  initialRole?: UserRole;
  initialStep?: Step;
};

const NAVY = "#243036";

type Step = "role" | "profile";

type CertificateDraft = {
  id: string;
  name: string;
  photo: string;
};

function createCertificateDraft(): CertificateDraft {
  return { id: crypto.randomUUID(), name: "", photo: "" };
}

function readImageFile(file: File, onLoad: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => onLoad(reader.result as string);
  reader.readAsDataURL(file);
}

type PhotoUploadFieldProps = {
  label: string;
  photo: string;
  uploadLabel: string;
  changeLabel: string;
  onPhotoChange: (photo: string) => void;
};

function PhotoUploadField({ label, photo, uploadLabel, changeLabel, onPhotoChange }: PhotoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) return;
    readImageFile(file, onPhotoChange);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: NAVY }}>
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-xl border border-dashed border-border bg-input-background flex items-center justify-center overflow-hidden shrink-0 hover:border-primary/40 transition-colors"
        >
          {photo ? (
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera size={22} className="text-muted-foreground" />
          )}
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          {photo ? changeLabel : uploadLabel}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export function OnboardingScreen({
  onComplete,
  initialRole = "parent",
  initialStep = "role",
}: OnboardingScreenProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(initialStep);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [childName, setChildName] = useState("");
  const [languages, setLanguages] = useState("");
  const [experience, setExperience] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licensePhoto, setLicensePhoto] = useState("");
  const [certificates, setCertificates] = useState<CertificateDraft[]>([]);
  const [error, setError] = useState("");

  const addCertificate = () => {
    setCertificates((prev) => [...prev, createCertificateDraft()]);
  };

  const updateCertificate = (id: string, patch: Partial<CertificateDraft>) => {
    setCertificates((prev) => prev.map((cert) => (cert.id === id ? { ...cert, ...patch } : cert)));
  };

  const removeCertificate = (id: string) => {
    setCertificates((prev) => prev.filter((cert) => cert.id !== id));
  };

  const handleRoleContinue = () => {
    setError("");
    setStep("profile");
  };

  const handleBack = () => {
    setError("");
    setStep("role");
  };

  const handleFinish = () => {
    if (!name.trim()) {
      setError(t("onboarding.nameRequired"));
      return;
    }
    if (!location.trim()) {
      setError(t("onboarding.locationRequired"));
      return;
    }
    if (!languages.trim()) {
      setError(t("onboarding.languagesRequired"));
      return;
    }

    if (role === "caregiver") {
      if (!licenseNumber.trim()) {
        setError(t("onboarding.licenseNumberRequired"));
        return;
      }
      if (!licensePhoto) {
        setError(t("onboarding.licensePhotoRequired"));
        return;
      }
      const hasIncompleteCertificate = certificates.some(
        (cert) => (cert.name.trim() && !cert.photo) || (!cert.name.trim() && cert.photo),
      );
      if (hasIncompleteCertificate) {
        setError(t("onboarding.certificateIncomplete"));
        return;
      }
    }

    const completedCertificates: CaregiverCertificate[] = certificates
      .filter((cert) => cert.name.trim() && cert.photo)
      .map((cert) => ({
        id: cert.id,
        name: cert.name.trim(),
        photo: cert.photo,
      }));

    onComplete({
      name: name.trim(),
      location: location.trim(),
      avatar: role === "caregiver" ? "photo-1544005313-94ddf0286df2" : "photo-1438761681033-6461ffad8d80",
      role,
      dueDate: dueDate.trim() || undefined,
      childName: childName.trim() || undefined,
      languages: languages.trim(),
      experience: experience.trim() || undefined,
      specialty: specialty.trim() || undefined,
      licenseNumber: role === "caregiver" ? licenseNumber.trim() : undefined,
      licensePhoto: role === "caregiver" ? licensePhoto : undefined,
      certificates: role === "caregiver" && completedCertificates.length > 0 ? completedCertificates : undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[55] flex flex-col px-7 pt-8 pb-8 overflow-y-auto"
      style={{ background: "#FFFFFF" }}
    >
      <div className="flex items-center justify-between mb-4">
        {step === "profile" ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={18} />
            {t("onboarding.back")}
          </button>
        ) : (
          <div />
        )}
        <span className="text-xs font-semibold text-muted-foreground">
          {step === "role" ? t("onboarding.step1of2") : t("onboarding.step2of2")}
        </span>
      </div>

      <div className="mb-5">
        <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY, fontFamily: "Nunito, sans-serif" }}>
          {step === "role" ? t("onboarding.stepRole") : t("onboarding.stepProfile")}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step === "role" ? t("onboarding.roleSubtitle") : t("onboarding.profileSubtitle")}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {step === "role" ? (
          <motion.div
            key="role"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="flex flex-col gap-3 flex-1"
          >
            <button
              type="button"
              onClick={() => setRole("parent")}
              className={`text-left rounded-2xl border-2 p-4 transition-all ${
                role === "parent"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    role === "parent" ? "bg-primary/15" : "bg-secondary"
                  }`}
                >
                  <Baby size={22} className={role === "parent" ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div>
                  <p className="font-bold text-foreground">{t("onboarding.roleParent")}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {t("onboarding.roleParentDesc")}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole("caregiver")}
              className={`text-left rounded-2xl border-2 p-4 transition-all ${
                role === "caregiver"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    role === "caregiver" ? "bg-primary/15" : "bg-secondary"
                  }`}
                >
                  <HeartHandshake size={22} className={role === "caregiver" ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div>
                  <p className="font-bold text-foreground">{t("onboarding.roleCaregiver")}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                    {t("onboarding.roleCaregiverDesc")}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleRoleContinue}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-primary/20 mt-4"
            >
              {t("onboarding.continue")}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="flex flex-col gap-3.5 flex-1"
          >
            <div className="inline-flex self-start items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold text-muted-foreground mb-1">
              {role === "parent" ? <Baby size={14} /> : <HeartHandshake size={14} />}
              {role === "parent" ? t("onboarding.roleParent") : t("onboarding.roleCaregiver")}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold" style={{ color: NAVY }}>
                {t("profile.name")} *
              </span>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("profile.namePlaceholder")}
                  className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold" style={{ color: NAVY }}>
                {t("profile.location")} *
              </span>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("profile.locationPlaceholder")}
                  className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </label>

            {role === "parent" ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: NAVY }}>
                    {t("onboarding.dueDate")}
                  </span>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      placeholder={t("onboarding.dueDatePlaceholder")}
                      className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: NAVY }}>
                    {t("onboarding.childName")}
                  </span>
                  <div className="relative">
                    <Baby size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder={t("onboarding.childNamePlaceholder")}
                      className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </label>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: NAVY }}>
                    {t("onboarding.experience")}
                  </span>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder={t("onboarding.experiencePlaceholder")}
                      className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: NAVY }}>
                    {t("onboarding.specialty")}
                  </span>
                  <div className="relative">
                    <Sparkles size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      placeholder={t("onboarding.specialtyPlaceholder")}
                      className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: NAVY }}>
                    {t("onboarding.licenseNumber")} *
                  </span>
                  <div className="relative">
                    <IdCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder={t("onboarding.licenseNumberPlaceholder")}
                      className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </label>

                <PhotoUploadField
                  label={`${t("onboarding.licensePhoto")} *`}
                  photo={licensePhoto}
                  uploadLabel={t("onboarding.uploadPhoto")}
                  changeLabel={t("onboarding.changePhoto")}
                  onPhotoChange={setLicensePhoto}
                />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: NAVY }}>
                      {t("onboarding.otherCertificates")}
                    </span>
                    <button
                      type="button"
                      onClick={addCertificate}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
                    >
                      <Plus size={14} />
                      {t("onboarding.addCertificate")}
                    </button>
                  </div>

                  {certificates.map((cert, index) => (
                    <div
                      key={cert.id}
                      className="rounded-2xl border border-border bg-card p-3.5 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t("onboarding.otherCertificates")} {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCertificate(cert.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:opacity-80"
                        >
                          <Trash2 size={12} />
                          {t("onboarding.removeCertificate")}
                        </button>
                      </div>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold" style={{ color: NAVY }}>
                          {t("onboarding.certificateName")}
                        </span>
                        <div className="relative">
                          <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            value={cert.name}
                            onChange={(e) => updateCertificate(cert.id, { name: e.target.value })}
                            placeholder={t("onboarding.certificateNamePlaceholder")}
                            className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </label>

                      <PhotoUploadField
                        label={t("onboarding.certificatePhoto")}
                        photo={cert.photo}
                        uploadLabel={t("onboarding.uploadPhoto")}
                        changeLabel={t("onboarding.changePhoto")}
                        onPhotoChange={(photo) => updateCertificate(cert.id, { photo })}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold" style={{ color: NAVY }}>
                {t("onboarding.languages")} *
              </span>
              <div className="relative">
                <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder={t("onboarding.languagesPlaceholder")}
                  className="w-full bg-input-background rounded-xl pl-10 pr-4 py-3 text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </label>

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

            <button
              type="button"
              onClick={handleFinish}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-primary/20 mt-2"
            >
              {t("onboarding.finish")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
