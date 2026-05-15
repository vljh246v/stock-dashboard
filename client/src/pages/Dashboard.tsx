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
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import StockDashboard from "@/components/StockDashboard";
import { DashboardLayoutSkeleton } from "@/components/DashboardLayoutSkeleton";
import { buildWatchlistDisplayItems } from "@/lib/watchlistDisplay";
import { normalizeStockSymbol } from "@shared/stockSymbols";

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const [, params] = useRoute("/dashboard/:symbol");
  const [, setLocation] = useLocation();
  const [newSymbol, setNewSymbol] = useState("");

  const selectedSymbol = params?.symbol ? normalizeStockSymbol(params.symbol) : "";

  const watchlistQuery = trpc.watchlist.list.useQuery(undefined, {
    enabled: !!user,
  });
  const pendingUsersQuery = trpc.auth.pendingUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
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
      toast.error(error.message || "종목을 추가하지 못했습니다. 티커를 다시 확인해 주세요.");
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

  const approveUserMutation = trpc.auth.approveUser.useMutation({
    onSuccess: approvedUser => {
      toast.success(`${approvedUser?.email || "사용자"} 계정을 승인했습니다.`);
      pendingUsersQuery.refetch();
    },
    onError: error => {
      toast.error(error.message || "사용자 승인을 처리하지 못했습니다.");
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
          <h1 className="text-2xl font-semibold text-foreground">로그인 후 이용할 수 있습니다</h1>
          <p className="text-sm text-muted-foreground text-center">
            관심 종목과 분석 결과를 보려면 먼저 로그인해 주세요.
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
    const symbol = normalizeStockSymbol(newSymbol);
    if (!symbol) return;
    addMutation.mutate({ symbol });
  };

  const watchlist = watchlistQuery.data || [];
  const watchlistItems = buildWatchlistDisplayItems(watchlist, selectedSymbol);
  const pendingUsers = (pendingUsersQuery.data || []).filter(
    pendingUser => pendingUser !== null
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden md:flex-row">
      {/* Sidebar */}
      <aside className="flex max-h-56 w-full shrink-0 flex-col border-b border-border bg-sidebar md:h-screen md:max-h-none md:w-64 md:border-b-0 md:border-r">
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
              placeholder="티커 추가 (예: AAPL)"
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
            ) : watchlistItems.length === 0 ? (
              <div className="text-center py-8 px-3">
                <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  아직 추가한 종목이 없습니다
                </p>
              </div>
            ) : (
              watchlistItems.map((item) => (
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
                  {item.saved ? (
                    <button
                      type="button"
                      aria-label={`${item.symbol} 제거`}
                      title="관심 종목에서 제거"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMutation.mutate({ symbol: item.symbol });
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${item.symbol} 추가`}
                      title="관심 종목에 추가"
                      disabled={addMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        addMutation.mutate({ symbol: item.symbol });
                      }}
                      className="p-1 hover:bg-sidebar-accent rounded disabled:opacity-50"
                    >
                      {addMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {user.role === "admin" && (
          <>
            <Separator />
            <div className="p-3 space-y-2 shrink-0">
              <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground">
                <UserCheck className="h-3.5 w-3.5" />
                가입 승인
              </div>
              {pendingUsersQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  확인 중
                </div>
              ) : pendingUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">대기 중인 계정이 없습니다</p>
              ) : (
                <div className="space-y-1.5">
                  {pendingUsers.map(pendingUser => (
                    <div
                      key={pendingUser.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {pendingUser.email || pendingUser.name || pendingUser.openId}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-xs"
                        disabled={approveUserMutation.isPending}
                        onClick={() => approveUserMutation.mutate({ userId: pendingUser.id })}
                      >
                        승인
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

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
      <main className="min-w-0 flex-1 overflow-y-auto">
        {selectedSymbol ? (
          <StockDashboard symbol={selectedSymbol} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <BarChart3 className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <h2 className="text-lg font-medium text-muted-foreground">분석할 종목을 선택하세요</h2>
              <p className="text-sm text-muted-foreground/70">
                왼쪽에서 종목을 고르거나 티커를 새로 추가해 주세요.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
