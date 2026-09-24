// Project-style function body pasted from a real SDK implementation.
//@param Width=500
//@param Depth=350
//@line 999
//@line 30
//@line 44
#include "StdAfx.h"
#include "FdStruct.h"
#include "Geo/PnGeometry.h"

#define PLATE_T 2
#define MAX_HOLES 6
#define HOLE_POS(i, n, w) (((i) + 0.5) * (w) / (n))

Acad::ErrorStatus GrillBlock::createGeometry(AcDbDatabase *pDb, const AcGeMatrix3d &mat)
{
    ASSERT(pDb != NULL);
    GRUNDFOSBlockCreator oBlkCreator(pDb, _T("GRILL"));
    double Width = 400;
    double Depth = 300;
    int holes = 4;
    get_val("Width", Width);
    get_val("Depth", Depth);
    get_val("Holes", holes);
    if (holes > MAX_HOLES) holes = MAX_HOLES;
    FdPoint3d p0(0, 0, 0);
    FdVector3d normal = FdVector3d::kZAxis;
    FdVector3d up = normal.perpVector();
    FLM3Geo::primitiveMode mode = FLM3Geo::pmNormal;
    if (m_geoRepMode == FLM3Geo::grmHLR) mode = FLM3Geo::pmIntInsulation;
    setPrimitiveMode(mode);
    ads_point legacy;
    legacy[0] = Width;
    legacy[1] = Depth;
    legacy[2] = PLATE_T;
    makeBox(1, {p0, p0 + normal * PLATE_T}, normal, Width, Depth, false);
    for (int i = 0; i < holes; i++)
    {
        double x = HOLE_POS(i, holes, Width) - Width / 2;
        FdPoint3d c = p0 + up * x + normal * PLATE_T;
        makeFlatDisc(c, normal, Depth / (holes + 1), cpx);
    }
    FdPoint3d corners[4];
    corners[0] = p0 + up * (Width / 2) + normal.crossProduct(up) * (Depth / 2);
    corners[1] = corners[0] - up * Width;
    corners[2] = corners[1] - normal.crossProduct(up) * Depth;
    corners[3] = corners[2] + up * Width;
    makeRectFace(corners, normal);
    oBlkCreator.finish(mat);
    delete pEnt;
    return Acad::eOk;
}
