// makeRectToTubeTransition (corners[4] and heightWidth[2] overloads, the n=10
// tessellation fallback for an unresolved complexity) and
// makeRectToTubeIntersection (with and without upVector).
FdPoint3d start(0, 0, 0);
FdVector3d normal = vx;
FdVector3d up = vz;
FdPoint3d corners[4] = {FdPoint3d(0, -100, 50), FdPoint3d(0, 100, 50), FdPoint3d(0, 100, -50), FdPoint3d(0, -100, -50)};
FdPoint3d shuffled[4] = {FdPoint3d(0, 100, -50), FdPoint3d(0, -100, 50), FdPoint3d(0, -100, -50), FdPoint3d(0, 100, 50)};
FdPoint3d tubeStart(200, 0, 0);
double tubeDiams[3] = {120, 80, 300};
double backwards[3] = {90, 90, -150};
double heightWidth[2] = {60, 140};
makeRectToTubeTransition(start, normal, up, corners, tubeStart, tubeDiams, 3);
makeRectToTubeTransition(start, normal, up, shuffled, tubeStart, tubeDiams, 1);
makeRectToTubeTransition(start, FdVector3d(1, 1, 0), vz, heightWidth, start + FdVector3d(1, 1, 0) * 150, tubeDiams, 2);
makeRectToTubeTransition(start, vz, vy, heightWidth, FdPoint3d(20, 10, 250), backwards, 4);
makeRectToTubeTransition(start, normal, up, corners, tubeStart, tubeDiams, projectComplexity);
// Invalid transitions: warnings, no substitute geometry.
double shortDiams[2] = {120, 80};
double zeroLength[3] = {120, 80, 0};
double badHeightWidth[2] = {0, 140};
FdPoint3d threeCorners[3] = {FdPoint3d(0, -100, 50), FdPoint3d(0, 100, 50), FdPoint3d(0, 100, -50)};
FdVector3d vectors4[4] = {vx, vy, vz, vx};
makeRectToTubeTransition(start, normal, up, corners, tubeStart, shortDiams, 3);
makeRectToTubeTransition(start, normal, up, corners, tubeStart, zeroLength, 3);
makeRectToTubeTransition(start, normal * 0, up, corners, tubeStart, tubeDiams, 3);
makeRectToTubeTransition(start, normal, up, badHeightWidth, tubeStart, tubeDiams, 3);
makeRectToTubeTransition(start, normal, up, threeCorners, tubeStart, tubeDiams, 3);
makeRectToTubeTransition(start, normal, up, vectors4, tubeStart, tubeDiams, 3);
makeRectToTubeTransition(start, normal, up, corners, tubeStart, tubeDiams, 0);
makeRectToTubeTransition(missingStart, normal, up, corners, tubeStart, tubeDiams, 3);
// makeRectToTubeIntersection: tubeParams {diamA, diamB, length},
// ductPosition {offsetLR, offsetUD}, ductParams {width, height, length}.
double tubeParams[3] = {200, 150, 600};
double ductPosition[2] = {300, 0};
double ductParams[3] = {100, 80, 200};
double offsetPosition[2] = {150, 30};
double outwardDuct[3] = {90.5, 60, -180};
double edgeDuct[3] = {600, 200, 101};
double centerPosition[2] = {300, 0};
makeRectToTubeIntersection(start, normal, up, tubeParams, ductPosition, ductParams, 3);
makeRectToTubeIntersection(start, FdVector3d(0, 1, 1), vx, tubeParams, offsetPosition, outwardDuct, 2);
makeRectToTubeIntersection(start, vz, tubeParams, ductPosition, ductParams, 1);
makeRectToTubeIntersection(FdPoint3d(10, 20, 30), vy, tubeParams, centerPosition, edgeDuct, 5);
// Invalid intersections.
double outsidePosition[2] = {20, 0};
double shortDuct[3] = {100, 80, 75};
double tooHigh[3] = {100, 250, 200};
double zeroTube[3] = {0, 150, 600};
makeRectToTubeIntersection(start, normal, up, tubeParams, outsidePosition, ductParams, 3);
makeRectToTubeIntersection(start, normal, up, tubeParams, ductPosition, shortDuct, 3);
makeRectToTubeIntersection(start, normal, up, tubeParams, ductPosition, tooHigh, 3);
makeRectToTubeIntersection(start, normal, up, zeroTube, ductPosition, ductParams, 3);
makeRectToTubeIntersection(start, normal, up, tubeParams, ductPosition, ductParams, 0);
makeRectToTubeIntersection(start, normal * 0, up, tubeParams, ductPosition, ductParams, 3);
makeRectToTubeIntersection(start, normal, missingUp, tubeParams, ductPosition, ductParams, 3);
makeRectToTubeIntersection(start, normal, up, tubeParams, ductPosition, ductParams, missingN);
makeRectToTubeIntersection(missingStart, normal, tubeParams, ductPosition, ductParams, 3);
