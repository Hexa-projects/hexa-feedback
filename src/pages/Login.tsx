import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { store } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logo from "@/assets/logo.png";
import type { UserProfile } from "@/types/forms";
import type { UserProfile } from "@/types/forms";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nome, setNome] = useState("");
  const [role, setRole] = useState<"admin" | "gestor" | "colaborador">("colaborador");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!nome.trim()) { setError("Informe seu nome"); return; }
    const user = store.login(nome.trim());
    if (!user) { setError("Usuário não encontrado. Cadastre-se primeiro."); return; }
    store.setCurrentUser(user);
    navigate(user.onboardingCompleto ? "/daily" : "/onboarding");
  };

  const handleRegister = () => {
    if (!nome.trim()) { setError("Informe seu nome"); return; }
    const existing = store.login(nome.trim());
    if (existing) { setError("Usuário já existe. Faça login."); return; }
    const user: UserProfile = {
      id: crypto.randomUUID(),
      nome: nome.trim(),
      setor: "Administrativo",
      funcao: "",
      unidade: "",
      resumoDiaDia: "",
      responsabilidades: "",
      qualidades: "",
      pontosMelhoria: "",
      tempoCasa: "",
      role,
      onboardingCompleto: false,
      createdAt: new Date().toISOString(),
    };
    store.saveUser(user);
    store.setCurrentUser(user);
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl hexa-gradient flex items-center justify-center mx-auto mb-4">
            <Hexagon className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Hexamedical</h1>
          <p className="text-sm text-muted-foreground">Coleta de Processos & Feedback</p>
        </div>

        <div className="hexa-card p-6 space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "login" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => { setMode("login"); setError(""); }}>
              Entrar
            </Button>
            <Button variant={mode === "register" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => { setMode("register"); setError(""); }}>
              Cadastrar
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={nome} onChange={e => { setNome(e.target.value); setError(""); }} placeholder="Seu nome" />
            </div>

            {mode === "register" && (
              <div>
                <Label>Perfil de acesso</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" onClick={mode === "login" ? handleLogin : handleRegister}>
              {mode === "login" ? "Entrar" : "Cadastrar e continuar"}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Base para o <strong>HexaOS</strong> e <strong>Focus AI</strong>
        </p>
      </div>
    </div>
  );
}
