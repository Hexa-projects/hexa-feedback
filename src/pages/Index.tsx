import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { Hexagon, ClipboardList, Repeat, AlertTriangle, Lightbulb } from "lucide-react";
import { useEffect } from "react";

export default function Index() {
  const navigate = useNavigate();
  const user = store.getCurrentUser();
  
  useEffect(() => {
    if (user) {
      navigate(user.onboardingCompleto ? "/daily" : "/onboarding");
    }
  }, [user, navigate]);

  return null;
}
