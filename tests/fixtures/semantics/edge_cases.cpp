// Hand-written semantics edge cases: section counts that are negative,
// fractional, larger than the arrays or non-numeric; flex control points;
// polyline counts; outputs; user functions shadowing SDK names.
//@line 23
//@line 40
FdPoint3d c[4] = {FdPoint3d(0, 0, 0), FdPoint3d(100, 0, 0), FdPoint3d(200, 50, 0), FdPoint3d(300, 50, 20)};
FdVector3d nv[4] = {vx, vx, FdVector3d(1, 1, 0), vx};
FdVector3d up[4] = {vz, vz, vz, vz};
double w[4] = {40, 50, 60, 70};
double h[4] = {20, 25, 30, 35};
double d2[4][2] = {{10, 12}, {14, 16}, {18, 20}, {22, 24}};
makeBox(-1, c, nv, up, w, h, true);
makeBox(10, c, nv, up, w, h, true);
makeBox(1.7, c, nv, up, w, h, true);
makeBox(true, c, nv, up, w, h, true);
makeBox(2, c, vy, 30, 40, true);
makeTube(c, nv, up, d2, 8, 2, false, true);
makeTube(c, nv, d2, 8, 0, false, false);
makeFlex(c, 3, vx, vy, 10, 5, 8, 9, 3, 6);
makeFlex(c, 1, vx, vy, 10, 5, 8, 9, 3, 6);
addCenterPolyLine(c, 2);
addCenterPolyLine(c, 7);
FdPoint3d hit(0, 0, 0);
lineSegToLineSegInt(c[0], c[1], FdPoint3d(50, -10, 0), FdPoint3d(50, 10, 0), hit);
lineToLineInt(c[0], c[1], FdPoint3d(0, 5, 0), FdPoint3d(10, 5, 0), hit);

void makeDisc(FdPoint3d center, FdVector3d normal)
{
    FdPoint3d moved = center + normal * 5;
    makeSimpleTube(center, moved, 10, 10, 4);
}

void drawFrame(const FdPoint3d &center, const FdVector3d &normal, const FdVector3d &upVector)
{
    makeFlatDisc(center, normal, upVector, 30, 4);
}

makeDisc(c[1], vz);
drawFrame(c[2], vy, vz);
for (int i = 0; i < 3; i++) {
    makeSimpleTube(c[i], c[i + 1], 10 + i, 12 + i, 4);
}
