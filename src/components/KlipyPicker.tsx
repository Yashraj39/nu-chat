import { KlipyPicker as SafeKlipyPicker } from "./KlipyPickerSafe";

type Props = {
  onClose: () => void;
  replyToMessageId?: string;
};

export function KlipyPicker(props: Props) {
  return <SafeKlipyPicker {...props} />;
}
