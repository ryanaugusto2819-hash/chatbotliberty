interface StatusBadgeProps {
  status: 'new' | 'pending' | 'active' | 'resolved';
}

const config = {
  new: { label: 'Novo', classes: 'bg-info/15 text-info' },
  pending: { label: 'Pendente', classes: 'bg-warning/15 text-warning' },
  active: { label: 'Em atendimento', classes: 'bg-primary/15 text-primary' },
  resolved: { label: 'Resolvido', classes: 'bg-success/15 text-success' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, classes } = config[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${classes}`}>
      {label}
    </span>
  );
}
