import type { ChangeEvent, KeyboardEvent, Ref } from 'react';
import type { SizeField } from '@/entities/connector';
import type { ConnectorType } from '@engine/geometry';

export interface LinkOrientationOption {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export interface LinkAxisField {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export type LinkIdentityFields = {
  name: string;
  point: string;
  nameError?: string;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPointChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPointBlur: () => void;
  onPointKeyDown: (event: KeyboardEvent) => void;
};

export type LinkSizeFields = {
  typeOptions: readonly ConnectorType[];
  typeIndex: number;
  circular: boolean;
  texts: Record<SizeField, string>;
  parameterNames: readonly string[];
  placeholder: string;
  errors: Readonly<Partial<Record<SizeField | 'type', string>>>;
  onTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onTextChanged: (field: SizeField) => (text: string) => void;
};

export type LinkRotationFields = {
  orientations: readonly LinkOrientationOption[];
  angles: readonly LinkAxisField[];
};

export type LinkStatus = {
  feedback: string;
  isError: boolean;
  test: () => void;
};

export type LinkFormProps = {
  disabled: boolean;
  nameRef: Ref<HTMLInputElement>;
  identity: LinkIdentityFields;
  size: LinkSizeFields;
  position: readonly LinkAxisField[];
  rotation: LinkRotationFields;
  status: LinkStatus;
};
