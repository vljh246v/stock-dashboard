import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BarChart3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type AuthMode = "login" | "register";

export default function Login() {
  const { user, loading, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, setLocation, user]);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await refresh();
      setLocation("/dashboard");
    },
    onError: error => toast.error(error.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async user => {
      if (user?.approvedAt) {
        await refresh();
        setLocation("/dashboard");
        return;
      }
      toast.success("가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
      setMode("login");
    },
    onError: error => toast.error(error.message),
  });

  const pending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "login") {
      loginMutation.mutate({ email, password });
      return;
    }
    registerMutation.mutate({ email, password, name: name || undefined });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BarChart3 className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "StockPulse 로그인" : "StockPulse 시작하기"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login"
                ? "관심 종목과 분석 대시보드를 이어서 확인해 주세요."
                : "가입 신청 후 승인되면 대시보드를 사용할 수 있습니다."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={event => setName(event.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : 1}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? "로그인" : "계정 만들기"}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "처음 오셨나요? 계정 만들기" : "이미 계정이 있으신가요? 로그인"}
        </Button>
      </div>
    </div>
  );
}
