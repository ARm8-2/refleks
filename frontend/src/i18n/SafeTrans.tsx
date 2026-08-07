import type { ReactElement } from "react";
import { Trans } from "react-i18next";
import type {
  TranslationKey,
  TranslationParams,
} from "./i18next.generated";

type RichTextValues<K extends TranslationKey> = keyof TranslationParams[K] extends never
  ? { values?: never }
  : { values: TranslationParams[K] };

type SafeTransProps<K extends TranslationKey> = RichTextValues<K> & {
  i18nKey: K;
  components: Record<string, ReactElement>;
};

export function SafeTrans<K extends TranslationKey>({
  i18nKey,
  components,
  values,
}: SafeTransProps<K>) {
  return (
    <Trans
      i18nKey={i18nKey as never}
      components={components}
      values={values as never}
    />
  );
}
