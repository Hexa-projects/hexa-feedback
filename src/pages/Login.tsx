import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import hexaLogo from "@/assets/hexaos-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp, user, profile, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    navigate(profile && !profile.onboarding_completo ? "/onboarding" : "/home", { replace: true });
  }, [authLoading, navigate, profile, user]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Preencha e-mail e senha"); return; }
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
        return;
      }

      navigate("/home");
    } catch {
      setError("Não foi possível entrar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !nome.trim()) { setError("Preencha todos os campos"); return; }
    if (password.length < 6) { setError("Senha deve ter no mínimo 6 caracteres"); return; }
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const { error: err } = await signUp(email.trim(), password, nome.trim());
      if (err) {
        setError(err.message);
        return;
      }

      setSuccessMsg("Cadastro realizado! Verifique seu e-mail para confirmar ou faça login.");
    } catch {
      setError("Não foi possível concluir o cadastro agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(20 14% 12%) 0%, hsl(20 12% 18%) 50%, hsl(24 20% 14%) 100%)' }}>
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, hsl(30 92% 52%), transparent)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-8" style={{ background: 'radial-gradient(circle, hsl(36 100% 62%), transparent)' }} />

      <div className="w-full max-w-sm space-y-6 animate-slide-up relative z-10">
        <div className="text-center space-y-3">
          <div className="w-24 h-24 mx-auto mb-2">
            <img src={hexaLogo} alt="HexaOS" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Hexa<span style={{ color: 'hsl(30, 92%, 52%)' }}>OS</span>
            </h1>
            <p className="text-sm text-white/50 mt-1">Sistema Operacional Corporativo</p>
          </div>
        </div>

        <div className="bg-card/95 backdrop-blur-sm rounded-2xl p-6 space-y-4 shadow-2xl border border-border/50">
          <div className="flex gap-2">
            <Button
              variant={mode === "login" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
            >
              Entrar
            </Button>
            <Button
              variant={mode === "register" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); }}
            >
              Cadastrar
            </Button>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <div>
                <Label>Nome completo</Label>
                <Input value={nome} onChange={e => { setNome(e.target.value); setError(""); }} placeholder="Seu nome" />
              </div>
            )}

            <div>
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="seu@email.com" />
            </div>

            <div>
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} placeholder="Mínimo 6 caracteres" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMsg && <p className="text-sm text-primary">{successMsg}</p>}

            <Button className="w-full" onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-white/30">
          Powered by <strong className="text-white/50">Focus AI</strong>
        </p>
      </div>
    </div>
  );
}
