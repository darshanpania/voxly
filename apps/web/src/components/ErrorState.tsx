import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  error: string;
  retry: () => void;
}

export function ErrorState({ error, retry }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <AlertTriangle className="w-12 h-12 text-danger opacity-70" />
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-text font-medium">Couldn't load your data</p>
        <p className="text-text-muted text-sm">{error}</p>
      </div>
      <Button variant="outline" size="sm" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
