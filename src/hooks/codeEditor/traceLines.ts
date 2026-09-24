import { RangeSet, StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutterLineClass, type DecorationSet } from '@codemirror/view';
import type { TraceLines } from '../../types/editor';

export const setTraceLinesEffect = StateEffect.define<TraceLines>();

class TracedLineNumberMarker extends GutterMarker {
  override elementClass = 'cm-tracedLineNumber';
}
const tracedLineNumberMarker = new TracedLineNumberMarker();

const traceLineDecoration = Decoration.line({ class: 'cm-traceLine' });
const activeTraceLineDecoration = Decoration.line({ class: 'cm-traceLine cm-traceLine-active' });

function validTraceLines(state: EditorState, trace: TraceLines): number[] {
  return [...trace.lines].filter((line) => line >= 1 && line <= state.doc.lines).sort((a, b) => a - b);
}

export const traceLinesField = StateField.define<TraceLines>({
  create: () => ({ lines: new Set(), activeLine: -1 }),
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setTraceLinesEffect)) value = effect.value;

    return value;
  },
  provide: (field) => [
    EditorView.decorations.compute([field, 'doc'], (state): DecorationSet => {
      const trace = state.field(field);

      return Decoration.set(
        validTraceLines(state, trace).map((line) =>
          (line === trace.activeLine ? activeTraceLineDecoration : traceLineDecoration).range(
            state.doc.line(line).from,
          ),
        ),
      );
    }),
    gutterLineClass.compute([field, 'doc'], (state) => {
      const trace = state.field(field);

      return RangeSet.of(
        validTraceLines(state, trace).map((line) => tracedLineNumberMarker.range(state.doc.line(line).from)),
      );
    }),
  ],
});
