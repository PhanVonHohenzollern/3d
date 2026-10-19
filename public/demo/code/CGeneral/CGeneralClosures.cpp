#include "StdAfx.h"
#include "CGeneral.h"

const int closureSegments = 10;

// Preview envelopes use catalog dimensions; thread helices are omitted.
short CGeneralBlockCreator::makeECTHR()
{
    double l = 0, dm = 0;
    get_val("l", l);
    get_val("dm", dm);
    if (l <= 0 || dm <= 0) return 1;

    FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0);
    makeSimpleTube(p1, p2, dm, dm, closureSegments);
    makeFlatDisc(p1, -FdVector3d::kXAxis, dm, closureSegments);
    makeFlatDisc(p2, FdVector3d::kXAxis, dm, closureSegments);
    addCenterLine(p1, p2);
    return 0;
}

short CGeneralBlockCreator::makeCTHR()
{
    double l = 0, d1 = 0, bore = 0;
    get_val("l", l);
    get_val("d1", d1);
    get_ext_diam("Left", bore);
    if (l <= 0 || bore <= 0 || d1 <= bore) return 1;

    FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0);
    makeSimpleTube(p1, p2, d1, d1, closureSegments);
    makeSimpleTube(p1, p2, bore, bore, closureSegments);
    makeFlatRing(p1, -FdVector3d::kXAxis, bore, d1, closureSegments);
    makeFlatRing(p2, FdVector3d::kXAxis, bore, d1, closureSegments);
    addCenterLine(p1, p2);
    return 0;
}

short CGeneralBlockCreator::makeECFLN()
{
    double l = 0;
    get_val("l", l);
    double df = GetFlgDiam("Left");
    if (l <= 0 || df <= 0) return 1;

    FdPoint3d p1(-l / 2, 0, 0), p2(l / 2, 0, 0);
    makeSimpleTube(p1, p2, df, df, closureSegments);
    makeFlatDisc(p1, -FdVector3d::kXAxis, df, closureSegments);
    makeFlatDisc(p2, FdVector3d::kXAxis, df, closureSegments);
    addCenterLine(p1, p2);
    return 0;
}

short CGeneralBlockCreator::makeECWLD()
{
    // No cap depth is declared: show the closure at the connector plane.
    double diam = 0;
    get_ext_diam("Left", diam);
    if (diam <= 0) return 1;

    FdPoint3d origin(0, 0, 0);
    makeFlatDisc(origin, FdVector3d::kXAxis, diam, closureSegments);
    makeFlatDisc(origin, -FdVector3d::kXAxis, diam, closureSegments);
    return 0;
}
