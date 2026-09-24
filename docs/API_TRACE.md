# API Trace and debug geometry

`src/core/runtime/ApiMetadata.generated.ts` holds the current SDK declarations.
`src/core/runtime/ApiSemantics.ts` adds relationships to the _matched overload_,
by formal parameter name. Both the trace table and debug resolver use these contracts.

Sources used to interpret the current declarations:

- 3DGeo Rectangular-KW-06.09.10, pp. 3-5: segmented boxes have count+1
  section centers and corresponding normals, up directions and dimensions.
- 3DGeo Circular-DK-07.11.06, pp. 14-28: tube section frames, common normals,
  simple tube endpoints and bend frames; pp. 30-44: disks/rings, intersections,
  spheroid axes/angle ranges, rectangular transitions and donut frames.
- Current `Geo/Int` SDK headers: explicit start/end tangent, rotation origin,
  truncation plane and output parameter declarations.
- Attachment 3 Geometry standards v2 describes primitive groups/complexity,
  rather than parameter contracts. It does not override API declarations.

The older PDF signatures sometimes encode positions/directions as double[6].
Those encodings must not be copied into the current FdPoint3d/FdVector3d
overloads, nor interpreted universally as the physical endpoints of a solid.

## Contracts

- Section arrays use the documented segment count plus one, not array capacity.
- A shared section normal is displayed at every used center. Array normals and
  up vectors use the same section index, including intermediate sections.
- Flex tangents use the first/last _used_ control point; truncation normals use
  centerTr; rotation axes use rotPoint. Angle pairs and dimension pairs retain
  their own roles. Input snapshots of output arguments are labeled and omitted
  from point overlays.
- Unknown vector relationships are left unanchored. Do not restore matching by
  variable spelling, neighboring argument position, or equal array lengths.
- Preview shows actual API point/vector inputs. Construction paths and evaluated
  expression displacements are not automatically added when reading provenance.
  Orientation arrows retain the existing common display scale.

## Provenance and navigation

Array parents retain their element rows. Each row separates name, type,
expression, scalar value/XYZ, role and source line. History is scoped by variable
lifetime and a captured history boundary; future mutations cannot leak in.
Collapsed arrays show their evaluated values; expanded arrays suppress that
summary. Element rows show the actual source variable and its current assignment
immediately, with dependencies directly below them. Older assignments are omitted
from the main tree. Double-clicking an API, parameter or dependency opens a separate
modeless history window for all parameters of that exact API call, including array
elements and earlier source-dependency assignments. Entries show source expression,
before/after values and line, newest first, excluding the current assignment and
future changes. Literal/default parameters remain visible without invented history.
Current parameter rows show their captured assignment expression, value and source
line, as in API Trace; older writes appear below them. Array summaries show their
values when collapsed and leave those values to the element rows when expanded.
Repeated double-clicks on the same API reuse the window; a new runtime result closes
the old snapshot window. Closing the history window leaves preview focus unchanged.
Double-clicking a history entry in the Earlier values window navigates to
its recorded source line and highlights the full line, text and gutter. Single
clicks only select entries. Rows without a source line do not navigate. History
navigation preserves the selected API, parameters, open dialog and preview snapshot.
Double-clicking a value with no earlier assignments navigates to its captured
definition and highlights that line. This includes individual array elements and
computed inputs with a single source, such as `-vCr`. Built-in values without a
source declaration do not navigate to an unrelated editor line.
Literal expressions are omitted when they merely repeat the evaluated value.
Only explicit tree expansion opens branches. Clicking a source line navigates
the editor without changing the execution position or API snapshot; subsequent
manual editor navigation resumes normal execution-to-cursor behavior.

Provenance reads the captured source values and assignments directly, including
resolved array indices. Browsing dependencies does not re-evaluate expressions
or generate construction geometry in the preview.

Without API focus, the preview shows only the current `p0` point from the code.
It has one name/value row in the left Points list; the Vectors list and all other
runtime variable markers are hidden. If `p0` is absent or is not a point, no
substitute point is created. Its position is independent of camera movement.
With API focus, two bounded, independently scrollable lists show only the
captured point/vector inputs. Each actual parameter has
its own name/value row, even if another parameter has identical coordinates.
There are no alias counts, source dependency rows, or synthetic section paths.
Clearing API focus restores the single `p0` point.
Details and scalar values remain in API Trace. The lists begin at the top of the
preview; a small bottom strip is reserved for the selection-mode button. No title,
mouse-help or statistics overlay occupies the parameter area.

The square grid is removed. World X/Y/Z axes retain their red/green/blue colors.
Labels X+/X-, Y+/Y- and Z+/Z- lie directly on the projected world axes near the
viewport edges. They follow orbit, pan and zoom, sliding along their own axis to
avoid the point/vector lists, controls and other labels. Segments behind the camera
are clipped before projection; an axis that does not reach an edge gets no invented
edge label. No separate orientation widget occupies the preview.
The signs share the Link orientation mapping: labelled X+/Y+/Z+ point opposite
the corresponding SDK unit vectors, and X-/Y-/Z- point along them.

Ctrl-click toggles values and Shift-click selects a range in either table; both
preview columns share one selection. Shift-click on 3D points/vectors toggles
them, while Ctrl-click on the ground in Point mode retains point creation. API Trace and preview
synchronize the entire selection without evaluating more source expressions.
Values from several API calls keep their own immutable snapshots. Selected Trace
cells use bold colored text; the corresponding source lines and gutter numbers
are highlighted in the editor without re-running the program. Selecting an
array selects its parameter elements. Hide/Show Selected applies to the whole
selection. Only selected parameters have leaders to their visible list rows.
A shared API direction appears once even when used at several section centers.

The single bottom-left `Select` button cycles Point (default), Vector, and Mesh.
Only the active type can be picked in the 3D view; a missed point or vector never
falls through to mesh selection. Points snap within 18 logical pixels and vectors
within 12 pixels of their shaft or arrow head. Hover highlights the prospective
target without changing the selection, API focus, or editor. Leaving the view,
changing modes, dragging, or hiding/replacing data clears hover. Table selections
remain explicit and independent of the 3D picking mode.

In Mesh mode, clicking a visible mesh selects the nearest intersected triangle,
highlights all parts from its API invocation and its creating API row, and highlights/navigates to its source line without
re-executing the scene. Other API parts are hidden using the same geometry filter
as explicit API selection, in both solid and wireframe modes. Fit Scene and
mesh picking use that same visibility filter. API Trace is filtered
to that exact creating call, and the preview lists show only its captured
point/vector parameters. Other loop iterations, unrelated calls and current
variables are excluded. Nested helper calls retain their original call indices
but display only the selected mesh API. Parameter expansion remains explicit;
multi-selection and provenance browsing keep the mesh filter. Clear API Focus
(also available with Esc anywhere in the application window)
restores all meshes, API rows and the `p0` point so another part can be
selected. Selecting a current variable also clears focus; re-execution clears
the mesh filter.
Actual triangles are
used, so clicks through holes can reach geometry behind them. Mesh mode ignores
debug point/vector markers; Point and Vector modes ignore mesh hits. Hidden or
API-filtered geometry cannot be picked. Scene replacement clears mesh selection.
Selecting a current variable in Variables highlights its last assignment without
re-execution; it does not add variable markers to the full-scene preview.
