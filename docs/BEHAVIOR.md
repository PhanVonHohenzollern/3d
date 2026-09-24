# Behavior

User-visible behavior of Geometry Preview. See also [API_TRACE.md](API_TRACE.md) and [BUILTIN_CONSTANTS.md](BUILTIN_CONSTANTS.md).

## Important behavior

The previewer does not create substitute geometry for an unknown API or for a known API without a supported mesh adapter. Such calls remain visible in API Trace and produce a warning instead of a misleading mesh.

`Parameters` is populated only from `get_val(...)` declarations and is independent of the current cursor position.

Debug vectors used by a native API are anchored to the point/section represented by the same immutable API call snapshot. A free vector that has no API-local origin is not shown at the global origin while API Focus is active.

## Current runtime fixes

- zero-argument user C++ helper calls execute their function body;
- omitted array extents are inferred from brace initializers;
- `sqrt`, `tan`, `atan` and related common math functions are supported;
- postfix operations work on temporary expressions such as `(b-a).normal()`;
- point/vector `operator[]`, `perpVector()`, tolerance forms of `normal/normalize`, and expression forms of `rotateBy` are supported;
- writable reference parameters are copied back to the caller;
- `lineSegToLineSegInt` / `lineToLineInt` update their output point when an intersection exists;
- object-like and expression-style function-like `#define` macros are imported from source (no project-specific macro names are hard-coded);
- mesh pre/post translation and rotation state is applied to generated meshes;
- invalid API arguments are reported instead of being replaced with unset values;
- invented `make/add/draw` calls are rejected rather than routed to generic geometry.

## makeBox / wireframe correction

The simple `makeBox(count, centralPoints, vectors, width, height, connectors)` overload now follows the documented local-frame rules: omitted `upVectors` use the same `perpVector()` convention as the runtime, `width` lies on `vector x upVector`, and `height` lies on `upVector`. Connector geometry extends from the section along its normal by connectorWidth; an explicit connectorWidth of 0 produces no connector extension.

Wireframe and API-selection outlines render feature edges rather than raw triangle edges, so triangulation diagonals no longer make rectangular primitives appear crossed or twisted.

Solid geometry is opaque and depth-tested on every frame, including after the
QPainter debug overlay. Wireframe shows edges through other geometry. Meshes
default to golden orange (RGB 255, 176, 0) until `setMeshColor(...)` changes the
active color; explicit colors, including `setMeshColor(0)`, remain unchanged.

## Geometry point/vector semantics

Native adapters follow the supplied SDK documentation:

- point/center/centroid inputs determine mesh positions;
- normal/vector/upVector/radiusVector inputs determine the local mesh frame and never become positions;
- array frames are section-local (`center[i]` with `normal[i]` / `upVector[i]`);
- rectangular width is measured along `normal x upVector`, height along `upVector`;
- circular SDK complexity `n` is multiplied by four as documented;
- unsupported primitives are not replaced by guessed proxy geometry.
- `makeRectToTubeTransition` supports both documented Fd overloads (explicit `corners[4]` and `heightWidth[2]`); the rectangle point(s) define position while `normal`/`upVector` orient the rectangular and elliptical sections.
- `makeRectToTubeIntersection` supports both documented Fd overloads; `start` positions the main tube, `normal`/`upVector` define its A/B frame, `ductPosition` locates the branch, and `ductParams` controls branch width/height/length.

## Rectangular-to-tube adapters

`makeRectToTubeTransition` now renders both Fd overloads: the explicit `corners[4]` form and the `heightWidth[2]` form. The rectangle is positioned by point inputs, `normal`/`upVector` define its local frame, the transition lofts to the ellipse at `tubeStart`, and the tube continues by `tubeDiams[2]`.

`makeRectToTubeIntersection` now renders both Fd overloads. The main elliptical tube uses `start` as position and `normal`/`upVector` as its A/B frame. The branch uses `ductPosition={offsetLR,offsetUD}` and `ductParams={width,height,length}`; the main tube mesh omits the corresponding side patch so the preview shows an opening rather than merely overlapping a box.

The rectangular branch and tube share the same intersection boundary. The tube
facets are split at the exact edges of the rectangular opening, and the branch
walls follow that faceted curve up to the outer rectangular end. This avoids gaps
from a flat branch base or rounding the hole to the nearest angular segment.
Only the two tube ends and the branch outlet remain open.

A standalone code fragment can use the [built-in defaults](BUILTIN_CONSTANTS.md), including `cpx=10`, `M_PI=3.141592653589793` and `ARX_PI=6.283185307179/2`, without declarations. Expressions such as `2*cpx` and `3*cpx` work directly. Source definitions can override these defaults. Other project-specific symbols and helper functions still require their actual definitions.

SDK numeric definitions and enums now come from a generated header registry,
including `LINK_SIZE_FACTOR`, line/symbol types and `FLM3Geo` modes. `ads_real`
is consistently treated as `double` in declarations, casts, `get_val` discovery
and API array overload matching; `ads_point` supplies the header's three-double
array type. See the built-in definitions document for supported forms and scope.

## Fix: unresolved native API arguments remain traceable

Native geometry calls are now kept in API Trace even when one argument cannot
be evaluated from a standalone snippet. The unresolved argument is stored as
`<unset>` and a diagnostic identifies the missing source expression.

For `makeRectToTubeTransition`, an unresolved final complexity argument only
affects tessellation. The preview renderer therefore uses `n=10` strictly as
a visualization sampling fallback while preserving the diagnostic and original
source expression. Position, orientation and dimensions are never guessed.

## API Focus parameter debug

The full-scene overview shows only the current `p0` and a single Points row.
The square grid is removed; colored world axes remain. X+/X-, Y+/Y-, Z+/Z- labels
sit on the projected axes near their intersections with the viewport edges and
follow rotation, pan and zoom. They avoid the point/vector lists and controls;
there is no separate orientation widget. API focus still shows that call's parameters.

API Focus displays only real point/vector parameters from the matched API signature.
It does not invent derived construction points such as rectangle corners, tube ends,
duct centers, or other helper geometry.

The existing `Show Points` and `Show Vectors` actions filter API-parameter debug by
type. A point/vector parameter row in API Trace can also be selected and controlled
with `Hide Selected Debug` / `Show Selected Debug`; clicking the corresponding
marker/vector in the viewport selects the same API Trace row.

## Link connector preview

The **Link** tab follows **API Trace**. Use **Add connector** to create a named
connector and its `linkPointN`. The Point field can be renamed; names must be
nonempty and unique within Link. Select its row/point, choose **Circular** or
**Rectangular**, then enter Diameter or A/B, X/Y/Z, Orientation and angles.
Dimension dropdowns suggest executed `get_val` variables. Fields also accept
current numeric variables, `get_val` keys and expressions such as `0.5*B`.
Unknown or invalid values report an error instead of substituting dimensions.

**X+/X-/Y+/Y-/Z+/Z-** sets the initial outward normal. Preview axis labels and
Link buttons share `previewOrientationDirection`: X+/Y+/Z+ point along the
negative SDK component axes, and X-/Y-/Z- along the positive component axes.
Angles **a, b, gamma** are
degrees applied in order about the world X, Y and Z axes, rotating both the normal
and rectangular section frame. A lies along `normal x up`; B lies along `up`
(world Z initially for horizontal connectors, world Y for Z-facing connectors).

**Test selected point** shows an open tube/rectangular sleeve extending outward
from the point, with a direction arrow. Its display length is 35% of the diameter
or larger rectangular dimension. Multiple tested connectors can be shown together;
selecting their row or clicking their point in Point mode highlights the selected
connector. Each row has a **Show/Hide** button that toggles its point, sleeve and
direction arrow independently. Show evaluates the connector if needed. **Esc**
exits Link preview by hiding every connector while retaining all definitions,
names and evaluated information; use Show or Test to display them again.
**Remove** deletes a connector. Editing geometry fields invalidates its old test;
renaming a point retains its visibility. Changes to runtime values refresh cached
tests without unhiding them, and hide any that can no longer be evaluated.
API focus hides Link tests; Show/Test clears that focus and fits the complete scene.

Connector definitions are held in memory for the current application session.
Tests use `geometry/ConnectorPreview` and the existing `PreviewGeometryEngine` API
adapters; they do not insert code, runtime variables or API Trace rows.

## Parameter value traces

Expand a parameter in API Trace to follow its current source variables.
Double-click an API or any of its parameter/source rows to open a separate
Earlier values window showing history for all parameters of that call, including
array elements, with source line, expression and before/after values. The main
tree contains no Earlier values branches. Literal arguments remain simple value rows.
Double-click a history entry in the Earlier values window to navigate
to and highlight its source line without changing the current API or preview.

These traces use immutable input snapshots and execution-history boundaries,
so repeated calls on the same source line retain their own loop iteration's
values. Array elements, point/vector members, helper parameter bindings, and
reference write-backs retain their provenance. Different invocations of a
helper do not share local-variable histories.

Clicking a trace row keeps the original API/parameter selected in the viewport.
Only explicit expansion loads its children, and expanded branches and the
selected trace row are retained when the preview refreshes.
