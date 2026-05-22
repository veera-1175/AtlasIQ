interface Props {
  label: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PlatformSectionHeader({ label, title, description, action }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-ink-800 pb-6">
      <div className="animate-fade-in">
        <p className="mono-label">{label}</p>
        {title && <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h2>}
        {description && <p className={`section-desc ${title ? "mt-3" : "mt-2"}`}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
