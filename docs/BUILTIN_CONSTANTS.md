# Built-in SDK constants

The runtime supplies these defaults before evaluating source macros or code.
They can be used directly in expressions, array sizes and API arguments without
adding declarations to the editor. Precision matches the supplied SDK definitions.

| Name                | Value              | Runtime type |
| ------------------- | ------------------ | ------------ |
| M_PI                | 3.141592653589793  | double       |
| cpx                 | 10                 | int          |
| SQRT_2              | 1.414213562373     | double       |
| TAN_60              | 1.732050807569     | double       |
| SIN_45              | 0.7071067811865    | double       |
| COS_45              | 0.7071067811865    | double       |
| COT_60              | 0.5773502691896    | double       |
| CONNECTOR_SIZE      | 45                 | int          |
| CONNECTOR_WIDTH     | 30                 | int          |
| ARX_PI              | 6.283185307179 / 2 | double       |
| GRILL_CANVAS_OFFSET | 15                 | int          |
| GRILL_CANVAS_SIZE   | 45                 | int          |
| LINK_SIZE_FACTOR    | 0.3                | double       |

ARX_PI intentionally differs slightly from M_PI for geometry tolerances.
`cpx=10` is the preview's default geometry complexity, also usable in expressions
such as `2*cpx` and `3*cpx`. It is a preview default rather than a mathematical constant.
Source declarations and supported object-like macros can override defaults.
Each preview execution restores defaults before applying that source's overrides.
Defaults do not add rows to Variables, but their captured values remain available
as dependencies in API Trace when referenced. No source lines are inserted.

## Header types and enum values

`ads_real` is a type alias for `double`, not a numeric constant. It works in
declarations, arrays, helper parameters, `get_val` discovery, C-style casts,
functional conversions (`ads_real(value)`) and `static_cast<ads_real>(value)`.
`ads_point` is the header's `double[3]` alias: indices 0/1/2 hold coordinates;
`ads_point points[2]` therefore has dimensions `[2][3]`. This does not imply a
mesh adapter for every legacy `ads_point` API.

Numeric macros and enums are generated from `FluidLib/FdStruct.h`,
`Geo/PnGeometry.h`, `Geo/PnGeometry3d.h` and `Geo/EntInfo.h`. These include
`hlrThin`, `hlrOutline`, `fdPlus`, `fdTriangleFilled`, `grmMESH`, `grmHLR`,
`grmSOLID`, `pmNormal`, `pmIntInsulation`, `pmExtInsulation` and object flags.
Namespace and enum-qualified forms, such as `FLM3Geo::pmNormal` and
`FLM3Geo::primitiveMode::pmNormal`, resolve to the same header value. Enum
declarations use the runtime's integer representation. Scalar typedefs and
enum types share the same registry across execution and overload matching.

The registry lives in `src/core/runtime/SdkDefinitions.generated.ts` (and the API
signatures in `ApiMetadata.generated.ts`). Both are data extracted from the SDK
headers; when the SDK headers change, update the entries to match.

The SDK is not required at build or run time. The registry covers numeric
macros, simple numeric enums and numeric typedefs; it does not cover arbitrary
header inclusion, class aliases (`FdMatrix3d`, `FdAcadColor`), export decorations
or a full C++ preprocessor. Known SDK typedef declarations can also be pasted into
the editor; unrelated custom typedefs are reported as unsupported.
