import { useState } from "react";
import { KlipyPicker as SafeKlipyPicker } from "./KlipyPickerSafe";

type Props = {
  onClose: () => void;
  replyToMessageId?: string;
};

export function KlipyPicker(props: Props) {
  const [isAdmin] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("pulse_user") || "null")?.role === "ADMIN";
    } catch {
      return false;
    }
  });

  return <SafeKlipyPicker {...props} isAdmin={isAdmin} />;
}
