// makeVerySimpleTube / makeSimpleTube: both SDK overloads (two points and
// FDcenterPoints[2]), tessellation n*4, and invalid inputs that warn instead
// of producing a mesh.
FdPoint3d p0(0, 0, 0);
FdPoint3d p1(250, 40, -30);
FdPoint3d ends[2] = {p0, p1};
FdPoint3d vertical[2] = {FdPoint3d(10, 20, 0), FdPoint3d(10, 20, 400)};
FdPoint3d single[1] = {p0};
makeVerySimpleTube(p0, p1, 80, 3);
makeVerySimpleTube(ends, 55.5, 1);
makeVerySimpleTube(vertical, 30, 2.6);
makeVerySimpleTube(p0, p0 + vy * 100, 20, cpx);
makeSimpleTube(p0, FdPoint3d(0, 0, 300), 100, 40, 5);
makeSimpleTube(ends, 60, 90, 2);
makeSimpleTube(vertical, 12.25, 7.75, 1);
// Invalid dimensions or arguments: warnings, no mesh.
makeVerySimpleTube(p0, p1, 0, 3);
makeVerySimpleTube(p0, p1, -5, 3);
makeVerySimpleTube(p0, p1, 10, 0);
makeVerySimpleTube(p1, p1, 10, 3);
makeVerySimpleTube(single, 10, 3);
makeVerySimpleTube(p0, vx, 10, 3);
makeVerySimpleTube(p0, p1, 10, missingComplexity);
makeSimpleTube(p0, p1, 10, 0, 3);
makeSimpleTube(p0, p1, 10, 20, -1);
makeSimpleTube(p0, p0, 10, 20, 3);
makeSimpleTube(single, 10, 20, 3);
makeSimpleTube(p0, p1, missingDiameter, 20, 3);
// Huge complexity is clamped to 4096 faces.
makeVerySimpleTube(p0, p1, 10, 5000);
