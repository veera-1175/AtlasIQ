import { useState } from "react";
import { Page } from "../../roles";
import Modal, { ModalBody, ModalFooter, ModalHeader } from "../Modal";

const STEPS: { title: string; body: string; page?: Page }[] = [
  {
    title: "Welcome to AtlasIQ",
    body: "You have the same Query Studio as your company admin — scoped to the tables assigned to you.",
  },
  {
    title: "Pick a database & focus tables",
    body: "In Query Studio, select a data source and optionally focus on specific tables before asking a question.",
    page: "analytics",
  },
  {
    title: "Explore your schema",
    body: "Schema Explorer shows allowed tables with a data preview. Click any table tag to jump there.",
    page: "schema",
  },
  {
    title: "Track your work",
    body: "My Usage shows your query stats and export. Query History lets you re-run past questions.",
    page: "my-usage",
  },
  {
    title: "Your profile",
    body: "Update your name and avatar, request password changes, and ask for more table access from My Profile.",
    page: "employee-profile",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
  onComplete: () => void;
}

export default function EmployeeOnboardingTour({ open, onClose, onNavigate, onComplete }: Props) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (current.page) onNavigate(current.page);
    if (isLast) {
      onComplete();
      onClose();
      return;
    }
    setStep((s) => s + 1);
  }

  function handleSkip() {
    onComplete();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleSkip}>
      <ModalHeader
        label="Getting started"
        title={current.title}
        subtitle={`Step ${step + 1} of ${STEPS.length}`}
        onClose={handleSkip}
      />
      <ModalBody>
        <p className="text-base leading-relaxed text-ink-300">{current.body}</p>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={handleSkip} className="btn-ghost text-sm">
          Skip tour
        </button>
        <button type="button" onClick={handleNext} className="btn-ink text-sm">
          {isLast ? "Get started" : "Next"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
