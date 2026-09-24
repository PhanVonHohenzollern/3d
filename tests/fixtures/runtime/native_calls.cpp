// Native API calls: registry matching, unresolved arguments, rejection.
//@line 999
//@line 8
FdPoint3d p0(0, 0, 0);
FdVector3d n = vx;
FdPoint3d pts[3] = {p0, p0 + n * 100, p0 + n * 200};
FdVector3d normals[3] = {vx, vx, vy};
double widths[3] = {10, 20, 30};
makeBox(2, pts, normals, 40, 50, false);
makeBox(1, pts, n, widths[1], 50, true);
makeSimpleTube(pts[1], pts[1] + vz * 300, 80, 60, cpx);
makeSimpleTube(pts[0], pts[2], widths[0] * 2, widths[2] / 3, UNDEFINED_COMPLEXITY);
makeSimpleTube(unknownStart, pts[2], 10, 10, 3);
makeRectToTubeTransition(p0, n, vz, 100, 50, p0 + n * 300, 60, 60, 200);
makeInventedShape(p0, 10);
addSomething(1);
drawThing();
makeBox();
customCall(p0, {1, 2, 3}, "text", pts);
customCall(1 / 0, missing);
ASSERT(p0 == p0);
ASSERT(unknownThing);
delete(p0);
setMeshColor(3);
setMeshColor(255, 0, 0);
preTransformMesh(p0, vz, 0.5);
makeSimpleTube(FdPoint3d(1, 2, 3), FdPoint3d(1, 2, 3) + FdVector3d(0, 0, 1) * 10, 5, 5, 3);
makeBox(1, {p0, p0 + vx * 10}, vx, 1, 1, false);
for (int i = 0; i < 3; i++)
    makeSimpleTube(pts[i], pts[i] + normals[i] * widths[i], widths[i], widths[i], i + 3);
