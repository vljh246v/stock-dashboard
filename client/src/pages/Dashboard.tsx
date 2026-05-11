import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Plus,
  Trash2,
  LogOut,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import StockDashboard from "@/components/StockDashboard";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [, params] = useRoute("/dashboard/:symbol");
  const [, setLocation] = useLocation();
  const [newSymbol, setNewSymbol] = useState("");

  const selectedSymbol = params?.symbol?.toUpperCase() || "";

  const watchlistQuery = trpc.watchlist.list.useQuery(undefined, {
    enabled: !!user,
  });

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: (data) => {
      setNewSymbol("");
      watchlistQuery.refetch();
      if (data?.symbol) {
        setLocation(`/dashboard/${data.symbol}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "종목을 추가할 수 없습니다. 정확한 티커를 입력해주세요.");
    },
  });

  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => {
      watchlistQuery.refetch();
      if (selectedSymbol) {
        setLocation("/dashboard");
      }
    },
  });

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <BarChart3 className="h-12 w-12 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">로그인이 필요합니다</h1>
          <p className="text-sm text-muted-foreground text-center">
            주식 분석 대시보드를 이용하려면 로그인해주세요.
          </p>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            로그인
          </Button>
        </div>
      </div>
    );
  }

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;
    addMutation.mutate({ symbol });
  };

  const watchlist = watchlistQuery.data || [];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border flex flex-col bg-sidebar shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border shrink-0">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm tracking-tight text-sidebar-foreground">StockPulse</span>
        </div>

        {/* Add Symbol */}
        <div className="p-3 border-b border-border shrink-0">
          <form onSubmit={handleAddSymbol} className="flex gap-2">
            <Input
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              placeholder="티커 입력 (예: AAPL)"
              className="h-8 text-xs bg-input border-border"
            />
            <Button
              type="submit"
              size="sm"
              variant="default"
              className="h-8 w-8 p-0 shrink-0"
              disabled={addMutation.isPending || !newSymbol.trim()}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </Button>
          </form>
        </div>

        {/* Watchlist */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {watchlistQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : watchlist.length === 0 ? (
              <div className="text-center py-8 px-3">
                <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  관심 종목을 추가해보세요
                </p>
              </div>
            ) : (
              watchlist.map((item) => (
                <div
                  key={item.id}
                  className={`group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors ${
                    selectedSymbol === item.symbol
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                  }`}
                  onClick={() => setLocation(`/dashboard/${item.symbol}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold">{item.symbol}</span>
                    {item.name && (
                      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMutation.mutate({ symbol: item.symbol });
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* User Footer */}
        <Separator />
        <div className="p-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground truncate">{user.name || user.email || "사용자"}</span>
          <Button variant="ghost" size="sm" onClick={logout} className="h-7 w-7 p-0">
            <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {selectedSymbol ? (
          <StockDashboard symbol={selectedSymbol} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <BarChart3 className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <h2 className="text-lg font-medium text-muted-foreground">종목을 선택하세요</h2>
              <p className="text-sm text-muted-foreground/70">
                사이드바에서 종목을 선택하거나 새 종목을 추가해주세요
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
