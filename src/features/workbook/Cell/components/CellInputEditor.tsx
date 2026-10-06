import type { ChangeEvent, FC, KeyboardEvent } from "react";
import { useState } from "react";
import styles from "./index.module.css";

type Props = {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
};

export const CellInputEditor: FC<Props> = ({
  initialValue,
  onCommit,
  onCancel,
}) => {
  // コンポーネントのマウント時に initialValue でローカル state を初期化 (key によるリセット設計)
  const [value, setValue] = useState(initialValue);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };

  const handleBlur = () => {
    onCommit(value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onCommit(value);
    } else if (event.key === "Escape") {
      onCancel();
    }
  };

  return (
    <input
      type="text"
      // biome-ignore lint/a11y/noAutofocus: 編集モード切替時に即座に入力可能にするため
      autoFocus
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={styles.cell__input}
    />
  );
};
