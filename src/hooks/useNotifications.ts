import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Notification {
  id: string;
  user_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link: string | null;
  metadata: any;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    
    const items = (data || []) as unknown as Notification[];
    setNotifications(items);
    setUnreadCount(items.filter(n => !n.lida).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as unknown as Notification;
          setNotifications(prev => [newNotif, ...prev].slice(0, 30));
          setUnreadCount(prev => prev + 1);

          // Show toast for new notifications
          const toastType = newNotif.tipo === "erro" ? "error" 
            : newNotif.tipo === "alerta" ? "warning"
            : newNotif.tipo === "sucesso" ? "success" 
            : "info";
          
          if (toastType === "error") {
            toast.error(newNotif.titulo, { description: newNotif.mensagem });
          } else if (toastType === "success") {
            toast.success(newNotif.titulo, { description: newNotif.mensagem });
          } else if (toastType === "warning") {
            toast.warning(newNotif.titulo, { description: newNotif.mensagem });
          } else {
            toast.info(newNotif.titulo, { description: newNotif.mensagem });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from("notifications" as any)
      .update({ lida: true })
      .eq("id", id);
    
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, lida: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications" as any)
      .update({ lida: true })
      .eq("user_id", user.id)
      .eq("lida", false);
    
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    setUnreadCount(0);
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase
      .from("notifications" as any)
      .delete()
      .eq("id", id);
    
    setNotifications(prev => {
      const n = prev.find(x => x.id === id);
      if (n && !n.lida) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(x => x.id !== id);
    });
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
}
