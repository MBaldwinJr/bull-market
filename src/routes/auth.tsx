import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/features/auth/use-auth";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/auth")({
  head: () => pageHead("Entrar", "Acesse seu terminal privado TRADING AI."),
  component: AuthPage,
});

const credsSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Mínimo de 8 caracteres").max(72),
});
type Creds = z.infer<typeof credsSchema>;

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<Creds>();

  useEffect(() => {
    if (session) void navigate({ to: "/" });
  }, [session, navigate]);

  const onSubmit = handleSubmit(async (raw) => {
    const parsed = credsSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    const { email, password } = parsed.data;
    const res =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "signup" && !res.data.session) toast.success("Conta criada. Confirme pelo link enviado ao seu e-mail.");
  });

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Falha ao entrar com Google");
  };

  return (
    <main className="terminal-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-md border bg-card p-6">
        <div className="mb-6 text-center">
          <div className="tabular text-2xl font-bold tracking-[0.3em] text-primary">TRADING AI</div>
          <p className="mt-1 text-xs text-muted-foreground">Terminal privado · Somente simulação</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="space-y-1">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              {...register("password", { required: true })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || formState.isSubmitting}>
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
        <Button type="button" variant="outline" className="w-full gap-2.5" onClick={() => void google()}>
          <GoogleLogo /> Continuar com Google
        </Button>
        <button
          type="button"
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-primary"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </main>
  );
}
