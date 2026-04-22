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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Mapeamento conversacional</h1>
              <p className="text-xs text-muted-foreground">Guiado pela Maya · Baseado em ISO 9001</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {completionReady && (
              <Button onClick={() => setShowReview(true)} variant="default" size="sm" className="gap-2">
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
      <div className="px-4 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto">
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
