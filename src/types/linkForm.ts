import type { ChangeEvent, KeyboardEvent, Ref } from 'react';
import type { ConnectorType } from '../core/geometry/ConnectorPreview';
import type { SizeField } from './panels';

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

export interface LinkFormProps {
  feedback: string;
  nameRef: Ref<HTMLInputElement>;
  typeOptions: readonly ConnectorType[];
  sizePlaceholder: string;
  orientations: readonly LinkOrientationOption[];
  positionFields: readonly LinkAxisField[];
  angleFields: readonly LinkAxisField[];
  disabled: boolean;
  name: string;
  point: string;
  typeIndex: number;
  sizeTexts: Record<SizeField, string>;
  parameterNames: readonly string[];
  circular: boolean;
  statusIsError: boolean;
  fieldErrors: Readonly<Record<string, string>>;
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPointChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPointBlur: () => void;
  onPointKeyDown: (event: KeyboardEvent) => void;
  onTypeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  sizeTextChanged: (field: SizeField) => (text: string) => void;
  test: () => void;
}
