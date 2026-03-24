import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Preencha e-mail e senha"); return; }
    setLoading(true);
    setError("");
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) { setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message); return; }
    navigate("/daily");
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !nome.trim()) { setError("Preencha todos os campos"); return; }
    if (password.length < 6) { setError("Senha deve ter no mínimo 6 caracteres"); return; }
    setLoading(true);
    setError("");
    const { error: err } = await signUp(email.trim(), password, nome.trim());
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccessMsg("Cadastro realizado! Verifique seu e-mail para confirmar ou faça login.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto mb-4">
            <img src={logo} alt="Hexamedical" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold">Hexamedical</h1>
          <p className="text-sm text-muted-foreground">Coleta de Processos & Feedback</p>
        </div>

        <div className="hexa-card p-6 space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "login" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}>
              Entrar
            </Button>
            <Button variant={mode === "register" ? "default" : "outline"} size="sm" className="flex-1" onClick={() => { setMode("register"); setError(""); setSuccessMsg(""); }}>
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

        <p className="text-center text-xs text-muted-foreground">
          Base para o <strong>HexaOS</strong> e <strong>Focus AI</strong>
        </p>
      </div>
    </div>
  );
}
