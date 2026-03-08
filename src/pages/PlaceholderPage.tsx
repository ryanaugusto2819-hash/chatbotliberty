import TopBar from '@/components/layout/TopBar';
import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
}

export default function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <div>
      <TopBar title={title} subtitle={subtitle} />
      <div className="flex flex-col items-center justify-center py-32 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent mb-4">
          <Construction className="h-8 w-8 text-accent-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Em Desenvolvimento</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Esta funcionalidade está sendo construída. Em breve estará disponível para uso.
        </p>
      </div>
    </div>
  );
}
