import type { ComponentType, ReactNode } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import type { Track } from "../types";
import { cn } from "../lib/format";
import { gradientFor } from "../lib/colors";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      className={cn("chip", active && "active")}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

interface EmptyStateProps {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  text?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="state-card">
      <div className="state-icon">
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Не удалось загрузить",
  message = "Проверьте подключение к интернету и попробуйте ещё раз.",
  onRetry
}: ErrorStateProps) {
  return (
    <div className="state-card">
      <div className="state-icon error">
        <CircleAlert size={26} strokeWidth={1.8} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn ghost" onClick={onRetry}>
          <RefreshCw size={16} />
          Повторить
        </button>
      )}
    </div>
  );
}

export function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="track-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton skeleton-art" />
          <div className="skeleton skeleton-line wide" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <div className="skeleton skeleton-square" />
          <div className="skeleton-lines">
            <div className="skeleton skeleton-line wide" />
            <div className="skeleton skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface MosaicProps {
  tracks: Track[];
  seed: string;
  icon?: ReactNode;
  className?: string;
}

export function Mosaic({ tracks, seed, icon, className }: MosaicProps) {
  const covers = tracks.filter((track) => Boolean(track.artwork)).slice(0, 4);
  if (!covers.length) {
    return (
      <div
        className={cn("mosaic", "placeholder", className)}
        style={{ background: gradientFor(seed) }}
      >
        {icon}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mosaic",
        covers.length === 1 && "single",
        covers.length === 2 && "two",
        className
      )}
    >
      {covers.map((track) => (
        <img key={track.id} src={track.artwork} alt="" loading="lazy" />
      ))}
    </div>
  );
}

interface CollectionHeaderProps {
  art: ReactNode;
  eyebrow: string;
  title: string;
  meta: ReactNode;
  actions?: ReactNode;
}

export function CollectionHeader({ art, eyebrow, title, meta, actions }: CollectionHeaderProps) {
  return (
    <header className="collection-header">
      <div className="collection-art">{art}</div>
      <div className="collection-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <div className="collection-meta">{meta}</div>
        {actions && <div className="collection-actions">{actions}</div>}
      </div>
    </header>
  );
}
