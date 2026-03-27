import { useState, useCallback } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  GridLayout,
  ParticipantTile,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Phone, PhoneOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface MeetingRoomProps {
  channelId?: string;
  channelName?: string;
  workOrderId?: string;
}

export default function MeetingRoom({ channelId, channelName, workOrderId }: MeetingRoomProps) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState("");

  const startMeeting = useCallback(async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      const room = channelId
        ? `channel-${channelId}`
        : workOrderId
        ? `os-${workOrderId}`
        : `meeting-${Date.now()}`;
      setRoomName(room);

      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: {
          roomName: room,
          participantName: profile.nome || "Participante",
          channelId,
          workOrderId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setToken(data.token);
      setServerUrl(data.url);
      setOpen(true);
    } catch (err: any) {
      console.error("Meeting error:", err);
      toast.error("Erro ao iniciar reunião: " + (err.message || "Falha desconhecida"));
    } finally {
      setLoading(false);
    }
  }, [user, profile, channelId, workOrderId]);

  const handleDisconnect = useCallback(() => {
    setToken(null);
    setServerUrl(null);
    setOpen(false);
    toast.success("Reunião encerrada");
  }, []);

  return (
    <>
      <Button
        onClick={startMeeting}
        disabled={loading}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Video className="h-4 w-4" />
        )}
        {loading ? "Conectando..." : "Reunião"}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleDisconnect(); }}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[1200px] h-[800px] p-0 overflow-hidden">
          {token && serverUrl && (
            <LiveKitRoom
              serverUrl={serverUrl}
              token={token}
              connect={true}
              onDisconnected={handleDisconnect}
              data-lk-theme="default"
              style={{ height: "100%", width: "100%" }}
            >
              <VideoConference />
              <RoomAudioRenderer />
            </LiveKitRoom>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
