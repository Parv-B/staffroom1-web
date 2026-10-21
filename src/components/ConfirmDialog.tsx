import type { ReactNode } from "react";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

interface Props {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A plain confirmation step for actions that lose work or can't be undone from here. */
export function ConfirmDialog({ isOpen, title, children, confirmLabel, cancelLabel = "Go back", onConfirm, onCancel }: Props) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      isDismissable
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
    >
      <Modal className="w-full max-w-lg bg-sheet p-6 shadow-[0_6px_20px_rgb(23_32_30/0.18)]">
        <Dialog role="alertdialog" className="outline-none">
          <Heading slot="title" className="t-subheading m-0">
            {title}
          </Heading>
          <div className="t-reading mt-3">{children}</div>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button className="button" onPress={onCancel} autoFocus>
              {cancelLabel}
            </Button>
            <Button className="button" data-variant="primary" onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
