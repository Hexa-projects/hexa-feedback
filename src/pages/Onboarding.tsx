import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/supabase-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Building2, CalendarClock, Cog, AlertTriangle, Phone, ArrowLeft, ArrowRight, Check } from "lucide-react";

import OnboardingStepIndicator from "@/components/onboarding/OnboardingStepIndicator";
import StepIdentidade from "@/components/onboarding/StepIdentidade";
import StepRotina from "@/components/onboarding/StepRotina";
import StepProcessos from "@/components/onboarding/StepProcessos";
import StepGargalos from "@/components/onboarding/StepGargalos";
import StepContato from "@/components/onboarding/StepContato";

const STEPS = [
  { label: "Identidade", icon: <Building2 className="w-4 h-4" /> },
  { label: "Rotina", icon: <CalendarClock className="w-4 h-4" /> },
  { label: "Processos", icon: <Cog className="w-4 h-4" /> },
  { label: "Gargalos", icon: <AlertTriangle className="w-4 h-4" /> },
  { label: "Contato", icon: <Phone className="w-4 h-4" /> },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, role, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(() => {
    const saved = sessionStorage.getItem("onboarding_step");
    return saved ? parseInt(saved, 10) : 0;
  });

  // Persist step to sessionStorage
  const updateStep = (updater: (prev: number) => number) => {
    setStep(prev => {
      const next = updater(prev);
      sessionStorage.setItem("onboarding_step", String(next));
      return next;
    });
  };

  const [form, setForm] = useState(() => {
    const saved = sessionStorage.getItem("onboarding_form");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      setor: profile?.setor || "Administrativo",
      funcao: profile?.funcao || "",
      unidade: "Hexamedical - SP",
      tempo_casa: profile?.tempo_casa || "",
      resumo_dia_dia: profile?.resumo_dia_dia || "",
      responsabilidades: profile?.responsabilidades || "",
      ferramentas_criticas: (profile as any)?.ferramentas_criticas || "",
      tarefas_repetitivas: "",
      tempo_tarefas_manuais: "",
      decisores: (profile as any)?.decisores || "",
      principal_gargalo: (profile as any)?.principal_gargalo || "",
      pontos_melhoria: profile?.pontos_melhoria || "",
      qualidades: profile?.qualidades || "",
      mudaria_no_setor: "",
      whatsapp: (profile as any)?.whatsapp || "",
      whatsapp_consent: (profile as any)?.whatsapp_consent || false,
    };
  });

  const update = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const stepValid = useMemo(() => {
    switch (step) {
      case 0: return !!(form.setor && form.funcao.trim() && form.unidade.trim());
      case 1: return !!(form.resumo_dia_dia.trim() && form.responsabilidades.trim());
      case 2: return !!(form.ferramentas_criticas.trim());
      case 3: return !!(form.principal_gargalo.trim());
      case 4: {
        const clean = form.whatsapp.replace(/\D/g, "");
        return clean.length >= 12 && clean.startsWith("55") && form.whatsapp_consent;
      }
      default: return false;
    }
  }, [step, form]);

  const handleSubmit = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        setor: form.setor,
        funcao: form.funcao,
        unidade: form.unidade,
        tempo_casa: form.tempo_casa,
        resumo_dia_dia: form.resumo_dia_dia,
        responsabilidades: form.responsabilidades,
        ferramentas_criticas: form.ferramentas_criticas,
        decisores: form.decisores,
        principal_gargalo: form.principal_gargalo,
        pontos_melhoria: form.pontos_melhoria,
        qualidades: form.qualidades,
        whatsapp: form.whatsapp,
        whatsapp_consent: form.whatsapp_consent,
        onboarding_completo: true,
      };
      await db.updateProfile(profile.id, payload);
      await refreshProfile();
      toast.success("Perfil completo! Bem-vindo ao HexaOS 🚀");
      navigate("/home");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (step === STEPS.length - 1) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const prev = () => setStep(s => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Onboarding HexaOS</h1>
          <p className="text-sm text-muted-foreground">Mapeamento de processos e identidade profissional</p>
        </div>

        {/* Step Indicator */}
        <OnboardingStepIndicator steps={STEPS} currentStep={step} />

        {/* Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm min-h-[380px] flex flex-col">
          <div className="flex-1">
            {step === 0 && <StepIdentidade form={form} update={update} />}
            {step === 1 && <StepRotina form={form} update={update} />}
            {step === 2 && <StepProcessos form={form} update={update} />}
            {step === 3 && <StepGargalos form={form} update={update} />}
            {step === 4 && (
              <StepContato
                form={form}
                update={update}
                setConsent={(v) => setForm(p => ({ ...p, whatsapp_consent: v }))}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 mt-4 border-t">
            <Button variant="ghost" onClick={prev} disabled={step === 0} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>

            <span className="text-xs text-muted-foreground">
              {step + 1} de {STEPS.length}
            </span>

            <Button onClick={next} disabled={!stepValid || saving} className="gap-2">
              {step === STEPS.length - 1 ? (
                saving ? "Salvando..." : <><Check className="w-4 h-4" /> Finalizar</>
              ) : (
                <>Próximo <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>

        {/* Admin skip */}
        {role === "admin" && (
          <div className="text-center">
            <Button
              variant="ghost"
              className="text-muted-foreground text-sm"
              onClick={async () => {
                if (!profile) return;
                setSaving(true);
                try {
                  await db.updateProfile(profile.id, { onboarding_completo: true });
                  await refreshProfile();
                  navigate("/home");
                } catch (err: any) {
                  toast.error("Erro ao pular: " + err.message);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              Preencher depois →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
