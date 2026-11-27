import {
  ChevronDownIcon,
  ChevronUpIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
  MixerHorizontalIcon,
} from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Popover,
  ScrollArea,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { type FC, useMemo, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { filterBarMessages } from "./i18n";
import styles from "./SearchFilterBar.module.css";

export type FilterFieldOption = {
  value: string;
  label: string;
};

export type FilterChipItem = {
  field: string;
  label: string;
  valueSummary: string;
  canRemove: boolean;
};

export type SearchFilterFieldModel = {
  field: string;
  label: string;
  required: boolean;
  selectionType: "single" | "multiple";
  options: FilterFieldOption[];
  selectedValues: string[];
};

export type SearchFilterBarPresenterProps = {
  hasFilters: boolean;
  isOpen: boolean;
  activeFilterCount: number;
  chips: FilterChipItem[];
  fields: SearchFilterFieldModel[];
  onToggleOpen: () => void;
  onClearAll: () => void;
  onRemoveChip: (field: string) => void;
  onChangeSingle: (field: string, value: string) => void;
  onChangeMultiple: (field: string, values: string[]) => void;
};

const MultiSelectField: FC<{
  field: SearchFilterFieldModel;
  onChange: (values: string[]) => void;
}> = ({ field, onChange }) => {
  const { t } = useI18n(filterBarMessages);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return field.options;
    const q = query.toLowerCase();
    return field.options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q),
    );
  }, [field.options, query]);

  const allFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((opt) =>
      field.selectedValues.includes(opt.value),
    );
  }, [filteredOptions, field.selectedValues]);

  const handleToggle = (value: string) => {
    if (field.selectedValues.includes(value)) {
      onChange(field.selectedValues.filter((v) => v !== value));
    } else {
      onChange([...field.selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    const allValues = Array.from(
      new Set([
        ...field.selectedValues,
        ...filteredOptions.map((opt) => opt.value),
      ]),
    );
    onChange(allValues);
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const triggerLabel = useMemo(() => {
    const count = field.selectedValues.length;
    if (count === 0) return t("allOption");
    if (count <= 2) {
      return field.selectedValues
        .map((v) => field.options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    return t("multiSelectSummary", { count });
  }, [field.selectedValues, field.options, t]);

  return (
    <Popover.Root>
      <Popover.Trigger>
        <Button
          size="2"
          variant={field.selectedValues.length > 0 ? "soft" : "surface"}
          color={field.selectedValues.length > 0 ? "blue" : "gray"}
          className={styles.multiSelectTrigger}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {triggerLabel}
          </span>
          <ChevronDownIcon width={14} height={14} style={{ flexShrink: 0 }} />
        </Button>
      </Popover.Trigger>

      <Popover.Content className={styles.multiSelectPopoverContent}>
        <TextField.Root
          size="1"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        >
          <TextField.Slot>
            <MagnifyingGlassIcon height="14" width="14" />
          </TextField.Slot>
          {query && (
            <TextField.Slot>
              <IconButton size="1" variant="ghost" onClick={() => setQuery("")}>
                <Cross2Icon height="12" width="12" />
              </IconButton>
            </TextField.Slot>
          )}
        </TextField.Root>

        <Flex justify="between" align="center">
          <Text size="1" color="gray">
            {field.selectedValues.length > 0
              ? t("multiSelectSummary", { count: field.selectedValues.length })
              : t("allOption")}
          </Text>
          <Flex gap="2">
            <Button
              type="button"
              size="1"
              variant="ghost"
              onClick={handleSelectAll}
              disabled={allFilteredSelected}
            >
              {t("selectAll")}
            </Button>
            <Button
              type="button"
              size="1"
              variant="ghost"
              onClick={handleDeselectAll}
              disabled={field.selectedValues.length === 0}
            >
              {t("deselectAll")}
            </Button>
          </Flex>
        </Flex>

        <ScrollArea
          type="auto"
          scrollbars="vertical"
          style={{ maxHeight: 200, paddingRight: 4 }}
        >
          {filteredOptions.length === 0 ? (
            <Text
              size="1"
              color="gray"
              style={{
                display: "block",
                textAlign: "center",
                padding: "12px 0",
              }}
            >
              {t("noOptions")}
            </Text>
          ) : (
            <Flex direction="column" gap="2">
              {filteredOptions.map((opt) => {
                const isChecked = field.selectedValues.includes(opt.value);
                return (
                  <Text
                    as="label"
                    size="2"
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggle(opt.value)}
                    />
                    <span style={{ fontSize: "var(--font-size-2)" }}>
                      {opt.label}
                    </span>
                  </Text>
                );
              })}
            </Flex>
          )}
        </ScrollArea>
      </Popover.Content>
    </Popover.Root>
  );
};

export const SearchFilterBarPresenter: FC<SearchFilterBarPresenterProps> = ({
  hasFilters,
  isOpen,
  activeFilterCount,
  chips,
  fields,
  onToggleOpen,
  onClearAll,
  onRemoveChip,
  onChangeSingle,
  onChangeMultiple,
}) => {
  const { t } = useI18n(filterBarMessages);

  if (!hasFilters) {
    return null;
  }

  return (
    <Box className={styles.filterBar}>
      <div className={styles.header}>
        {isOpen ? (
          <div className={styles.titleGroup}>
            <span className={styles.title}>
              <MixerHorizontalIcon width={16} height={16} />
              {t("title")}
            </span>
            {activeFilterCount > 0 && (
              <Badge size="1" color="blue" variant="solid">
                {t("activeCount", { count: activeFilterCount })}
              </Badge>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={styles.collapsedSummaryGroup}
            onClick={onToggleOpen}
            title={t("expand")}
          >
            <MixerHorizontalIcon
              width={16}
              height={16}
              style={{ color: "var(--gray-10)", flexShrink: 0 }}
            />
            {activeFilterCount === 0 ? (
              <span className={styles.emptyHint}>{t("noFiltersApplied")}</span>
            ) : (
              chips.map((chip) => (
                <Badge
                  key={chip.field}
                  size="1"
                  color="blue"
                  variant="soft"
                  className={styles.summaryChip}
                >
                  <span>
                    <strong>{chip.label}:</strong> {chip.valueSummary}
                  </span>
                  {chip.canRemove && (
                    <button
                      type="button"
                      className={styles.chipDeleteButton}
                      aria-label={t("clearAll")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveChip(chip.field);
                      }}
                    >
                      <Cross2Icon width={10} height={10} />
                    </button>
                  )}
                </Badge>
              ))
            )}
          </button>
        )}

        <div className={styles.actionsGroup}>
          {activeFilterCount > 0 && (
            <Button
              size="1"
              variant="ghost"
              color="gray"
              onClick={onClearAll}
              style={{ cursor: "pointer" }}
            >
              {t("clearAll")}
            </Button>
          )}

          <Button
            size="1"
            variant="soft"
            color="gray"
            onClick={onToggleOpen}
            style={{ cursor: "pointer" }}
          >
            {isOpen ? (
              <>
                <ChevronUpIcon width={14} height={14} />
                {t("collapse")}
              </>
            ) : (
              <>
                <ChevronDownIcon width={14} height={14} />
                {t("expand")}
              </>
            )}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className={styles.content}>
          {fields.map((f) => (
            <div key={f.field} className={styles.filterItem}>
              <div className={styles.itemLabelRow}>
                <span>{f.label}</span>
                {f.required && (
                  <span
                    className={styles.requiredStar}
                    title={t("requiredBadge")}
                  >
                    *
                  </span>
                )}
              </div>

              {f.selectionType === "single" ? (
                <Select.Root
                  size="2"
                  value={
                    f.selectedValues.length > 0
                      ? f.selectedValues[0]
                      : f.required && f.options.length > 0
                        ? f.options[0].value
                        : "__all__"
                  }
                  onValueChange={(val) => onChangeSingle(f.field, val)}
                >
                  <Select.Trigger
                    color={f.selectedValues.length > 0 ? "blue" : undefined}
                    style={{ width: "100%" }}
                  />
                  <Select.Content position="popper">
                    {!f.required && (
                      <>
                        <Select.Item value="__all__">
                          {t("allOption")}
                        </Select.Item>
                        <Select.Separator />
                      </>
                    )}
                    {f.options.map((opt) => (
                      <Select.Item key={opt.value} value={opt.value}>
                        {opt.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              ) : (
                <MultiSelectField
                  field={f}
                  onChange={(vals) => onChangeMultiple(f.field, vals)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Box>
  );
};
