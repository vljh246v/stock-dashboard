import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { BarChart3, TrendingUp, Shield, Brain } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  if (!loading && user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">StockPulse</span>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            variant="default"
            size="sm"
          >
            로그인
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            AI 기반 <span className="text-primary">주식 분석</span> 대시보드
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            종목 티커를 입력하면 기업 개요, 기술적 분석, 재무 지표, 거버넌스, 뉴스 감성까지
            전문적인 금융 분석을 한눈에 확인하세요.
          </p>

          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="px-8 py-3 text-base"
          >
            시작하기
          </Button>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-12">
            <FeatureCard
              icon={<TrendingUp className="h-5 w-5" />}
              title="기술적 분석"
              desc="MACD, RSI, 지지/저항선 등 핵심 기술 지표"
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="재무 분석"
              desc="밸류에이션, 애널리스트 평가, 기업 품질 점수"
            />
            <FeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="거버넌스"
              desc="내부자 거래, 경영진 지분, SEC 공시 추적"
            />
            <FeatureCard
              icon={<Brain className="h-5 w-5" />}
              title="AI 투자 의견"
              desc="LLM 기반 Bull/Bear 분석 및 감성 점수"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 text-left space-y-2">
      <div className="text-primary">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
