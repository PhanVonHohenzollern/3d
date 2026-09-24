// SDK typedefs and enums in declarations, casts and typedef statements.
//@line 999
typedef double ads_real;
typedef double ads_point[3];
typedef int FLM3Geo::primitiveMode;
typedef float ads_real;
typedef double ads_point[4];
typedef double myReal;
typedef MyThing other;
typedef;
ads_real r = 1.25;
ads_point pt = {1, 2, 3};
ads_point pts[2];
pts[1][2] = 9;
ads_real reals[] = {1, 2, 3};
FLM3Geo::primitiveMode mode = FLM3Geo::primitiveMode::pmIntInsulation;
FLM3Geo::geoRepMode rep = FLM3Geo::grmHLR;
geoRepMode rep2 = grmSOLID;
line_type lt = 3;
hlr_curve_type hc = hlrOutline;
fdCircSymbType sym = fdPlus;
ElementRole role = ElementRole::rlCorner3D;
int flags = fdTriangleFilled + grmMESH;
double mixed = (ads_real)mode + static_cast<line_type>(2.5);
makeSimpleTube(FdPoint3d(pt[0], pt[1], pt[2]), FdPoint3d(0, 0, 0), r, reals[2], mode);
