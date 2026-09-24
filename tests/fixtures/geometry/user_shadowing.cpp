// A source helper may reuse an SDK name. The C++ primitive adapters match by
// name only (and effectiveArguments fills metadata defaults), so a helper named
// like a primitive still produces that primitive's mesh; composite adapters
// and the missing-adapter warning skip helper calls.
FdPoint3d p0(0, 0, 0);
void makeFlatDisc(FdPoint3d c, FdVector3d n, double d, int k)
{
    makeVerySimpleTube(c, c + n * d, d * 0.25, k);
}
void makeStraightTube(FdPoint3d c, double d)
{
    makeSymbolicCircle(c, vz, d);
}
void makeFacettedCylinder(FdPoint3d a, FdPoint3d b, FdVector3d up, double d, double s, double e, double i)
{
    makeFlatRing(a, vz, d, d * 2, 1);
}
void makeWidget(FdPoint3d c)
{
    makeFlatDisc(c, vx, 40, 1);
}
makeFlatDisc(p0, vz, 100, 2);
makeStraightTube(p0, 80);
makeFacettedCylinder(p0, p0 + vz * 100, vx, 50, 0, 90, 4);
makeWidget(p0 + vy * 200);
