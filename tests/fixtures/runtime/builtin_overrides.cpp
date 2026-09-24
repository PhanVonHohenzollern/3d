// Built-in defaults and their overrides by macros and declarations.
#define cpx 12
#define M_PI 3
//@line 14
//@line 22
//@eval cpx
//@eval M_PI
//@eval ARX_PI
//@eval SQRT_2 * COS_45
//@eval m_primitiveMode
//@eval FLM3Geo::pmIntInsulation
double a = 2 * cpx;
double b = M_PI;
double c = ARX_PI;
double d = TAN_60 + SIN_45 + COT_60 + LINK_SIZE_FACTOR;
int e = CONNECTOR_SIZE + CONNECTOR_WIDTH + GRILL_CANVAS_OFFSET + GRILL_CANVAS_SIZE;
FdVector3d f = vx + vy + vz;
int g = m_geoRepMode + m_primitiveMode;
double cpx = 5.5;
double h = 2 * cpx;
FdVector3d vx(0, 0, 2);
FdVector3d i = vx;
makeSimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(0, 0, 0) + vx, cpx, M_PI, CONNECTOR_SIZE);
