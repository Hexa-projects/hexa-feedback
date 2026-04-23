import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

import OnboardingProgressRail from "@/components/onboarding/OnboardingProgressRail";
import OnboardingConversationPane, { ChatMessage } from "@/components/onboarding/OnboardingConversationPane";
import OnboardingSummaryPane from "@/components/onboarding/OnboardingSummaryPane";
import OnboardingReviewScreen from "@/components/onboarding/OnboardingReviewScreen";

export default function OnboardingChatPage() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState("intro");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [completionReady, setCompletionReady] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [structuredProfile, setStructuredProfile] = useState<any>(null);
  const [structuredProcesses, setStructuredProcesses] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [finalizing, setFinalizing] = useState(false);
  const initialized = useRef(false);

  // Bootstrap session
  useEffect(() => {
    if (!profile?.id || initialized.current) return;
    initialized.current = true;
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const reloadStructuredState = async (sid: string) => {
    const [{ data: prof }, { data: procs }] = await Promise.all([
      supabase.from("onboarding_profiles").select("*").eq("session_id", sid).maybeSingle(),
      supabase.from("onboarding_process_maps").select("*").eq("session_id", sid).order("created_at"),
    ]);
    setStructuredProfile(prof);
    setStructuredProcesses(procs ?? []);
  };

  const bootstrap = async () => {
    if (!profile?.id) return;

    // Look for active session
    const { data: existing } = await supabase
      .from("onboarding_sessions")
      .select("id, current_stage, completion_percentage, status")
      .eq("user_id", profile.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      setSessionId(existing.id);
      setProgress(existing.completion_percentage ?? 0);
      setCurrentStage(existing.current_stage ?? "intro");

      // Load messages
      const { data: msgs } = await supabase
        .from("onboarding_messages")
        .select("id, role, content, created_at")
        .eq("session_id", existing.id)
        .order("created_at", { ascending: true });

      setMessages(
        (msgs ?? []).map((m: any) => ({
          id: m.id, role: m.role, content: m.content, ts: m.created_at,
        }))
      );

      await reloadStructuredState(existing.id);

      // If no messages yet, kick off
      if (!msgs || msgs.length === 0) {
        await sendMessage("", existing.id);
      }
    } else {
      // No session — start one with kickoff
      await sendMessage("");
    }
  };

  const sendMessage = async (text: string, sid?: string | null) => {
    setThinking(true);

    // Optimistic user message (only if non-empty)
    if (text) {
      const optimistic: ChatMessage = {
        id: `tmp-${Date.now()}`, role: "user", content: text,
      };
      setMessages((prev) => [...prev, optimistic]);
    }

    try {
      const { data, error } = await supabase.functions.invoke("onboarding-conversation", {
        body: { message: text, session_id: sid ?? sessionId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.session_id && !sessionId) setSessionId(data.session_id);
      setProgress(data.progress ?? 0);
      setCurrentStage(data.current_stage ?? "perfil");
      setMissingFields(data.missing_fields ?? []);
      setCompletionReady(!!data.completion_ready);

      setMessages((prev) => [
        ...prev.filter((m) => !m.id.startsWith("tmp-")),
        ...(text
          ? [{ id: `u-${Date.now()}`, role: "user" as const, content: text }]
          : []),
        { id: `a-${Date.now()}`, role: "assistant" as const, content: data.assistant_message },
      ]);

      if (data.session_id) await reloadStructuredState(data.session_id);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao falar com a Maya");
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("tmp-")));
    } finally {
      setThinking(false);
    }
  };

  const handleFinalize = async () => {
    if (!sessionId) return;
    setFinalizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("onboarding-finalize", {
        body: { session_id: sessionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsights(data.insights);

      toast.success("Onboarding concluído! Bem-vindo ao HexaOS 🚀");
      await refreshProfile();
      setTimeout(() => navigate("/home"), 1200);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao finalizar");
    } finally {
      setFinalizing(false);
    }
  };

  if (showReview) {
    return (
      <div className="min-h-screen bg-background p-4 lg:p-8">
        <OnboardingReviewScreen
          profile={structuredProfile}
          processes={structuredProcesses}
          insights={insights}
          finalizing={finalizing}
          onConfirm={handleFinalize}
          onContinue={() => setShowReview(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.03] relative">
      {/* Decorative gradient blobs */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none -z-0" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none -z-0" />

      {/* Header */}
      <header className="border-b border-border/40 bg-background/70 backdrop-blur-xl sticky top-0 z-20">
        <div className="px-4 lg:px-8 py-3.5 flex items-center justify-between max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight">
                Mapeamento conversacional
              </h1>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span>Guiado pela Maya</span>
                <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/60" />
                <span>Baseado em ISO 9001</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {completionReady && (
              <Button
                onClick={() => setShowReview(true)}
                size="sm"
                className="gap-2 bg-gradient-to-r from-primary to-primary/85 shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Revisar e concluir
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => navigate("/home")}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* 3-col layout */}
      <div className="relative px-4 lg:px-8 py-6 flex flex-col lg:flex-row gap-5 max-w-[1600px] mx-auto">
        <OnboardingProgressRail
          currentStage={currentStage}
          progress={progress}
          missingFields={missingFields}
        />

        <div className="flex-1 flex flex-col">
          <OnboardingConversationPane
            messages={messages}
            onSend={(t) => sendMessage(t)}
            thinking={thinking}
          />
        </div>

        <OnboardingSummaryPane profile={structuredProfile} processes={structuredProcesses} />
      </div>
    </div>
  );
}
