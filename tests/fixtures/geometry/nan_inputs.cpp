// Non-finite inputs (NaN from sqrt(-1), inf from overflow) pass several
// adapter checks in the C++; the preview must reproduce the same meshes,
// NaN colors and sort orders instead of guessing.
double nan = sqrt(-1.0);
double big = 1e308 * 10;
FdPoint3d p0(0, 0, 0);
FdPoint3d p1(0, 0, 100);
makeFacettedCylinder(p0, p1, vx, 50, nan, 90, 4);
makeFacettedCylinder(p0, p1, vx, 50, 0, nan, 4, true, true);
makeVerySimpleTube(p0, p1, nan, 3);
makeFlatRing(p0, vz, nan, 50, 2);
makeSymbolicCircle(p0, vz, big);
setMeshColor(nan, 128, big);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(nan);
makeFlatDisc(p0, vz, 40, 1);
double tubeParams[3] = {200, 150, 600};
double ductPosition[2] = {nan, 0};
double ductParams[3] = {100, 80, 200};
makeRectToTubeIntersection(p0, vx, vz, tubeParams, ductPosition, ductParams, 2);
double ductPosition2[2] = {300, nan};
makeRectToTubeIntersection(p0, vx, vz, tubeParams, ductPosition2, ductParams, 2);
FdPoint3d corners[4] = {FdPoint3d(0, -100, 50), FdPoint3d(0, 100, nan), FdPoint3d(0, 100, -50), FdPoint3d(0, -100, -50)};
double tubeDiams[3] = {120, 80, 300};
makeRectToTubeTransition(p0, vx, vz, corners, FdPoint3d(200, 0, 0), tubeDiams, 2);
makeRectFace(p0, vz, FdVector3d(nan, 0, 1), 10, 20);
double latN[2] = {0, nan};
double lon[2] = {0, 360};
double diams[3] = {100, nan, 50};
int n[2] = {2, 3};
makeSpheroidSection(p0, vz, vx, latN, lon, diams, n);
makeDonutSection(p0, vz, vx, nan, 20, 90, 1, 2);
makeTube(corners, corners, corners, corners, 1, 1, false, false);
preTransformMesh(nan, vz);
makeFlatDisc(p0, vz, 40, 1);
