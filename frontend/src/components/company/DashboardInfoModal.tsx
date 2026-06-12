import { Page } from "../../roles";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../Modal";

export interface DashboardInfo {
  id: string;
  category: string;
  title: string;
  description: string;
  bullets?: string[];
  stats?: { label: string; value: string }[];
  action?: { label: string; page: Page };
}

interface Props {
  info: DashboardInfo | null;
  onClose: () => void;
  onNavigate: (page: Page) => void;
}

export default function DashboardInfoModal({ info, onClose, onNavigate }: Props) {
  if (!info) return null;

  return (
    <Modal open onClose={onClose} size="md" titleId="dashboard-info-title">
      <ModalHeader
        label={info.category}
        title={info.title}
        titleId="dashboard-info-title"
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
        <p className="text-sm leading-relaxed text-ink-300">{info.description}</p>
        {info.bullets && info.bullets.length > 0 && (
          <ul className="space-y-2 border border-ink-800 bg-black p-4 text-sm text-ink-400">
            {info.bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-white">—</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {info.stats && info.stats.length > 0 && (
          <dl className="divide-y divide-ink-900 border border-ink-800">
            {info.stats.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="mono-label text-[10px]">{label}</dt>
                <dd className="font-mono text-sm text-white">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="btn-ghost flex-1">
          Close
        </button>
        {info.action && (
          <button
            type="button"
            onClick={() => {
              onNavigate(info.action!.page);
              onClose();
            }}
            className="btn-ink flex-1"
          >
            {info.action.label}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}
