import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-4 selection:bg-primary/20">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500 ease-out">
        <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-destructive/50 to-transparent opacity-50" />
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-8 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center border border-destructive/20 shadow-[0_0_30px_-5px_rgba(var(--destructive),0.3)]">
              <AlertTriangle className="w-8 h-8 text-destructive" strokeWidth={1.5} />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-mono tracking-tight text-foreground" data-testid="text-error-code">
                404
              </h1>
              <p className="text-xs font-mono text-muted-foreground tracking-[0.2em] uppercase">
                Sector Not Found
              </p>
            </div>

            <div className="h-[1px] w-12 bg-border" />

            <Link href="/" className="text-xs font-mono text-primary hover:text-primary/80 transition-colors uppercase tracking-[0.1em] cursor-pointer" data-testid="link-return-home">
              Return to Uplink
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
