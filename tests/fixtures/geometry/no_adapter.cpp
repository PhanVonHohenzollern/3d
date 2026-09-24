// Registry APIs without a preview adapter: geometry headers warn and draw
// nothing; PnGeometry.h 2-D helpers, append*/calc*/SidePoints and non-geometry
// calls are traced silently; invented make* names are rejected by the runtime.
FdPoint3d p0(0, 0, 0);
FdPoint3d p1(100, 0, 0);
bool sides4[4] = {true, true, true, true};
makeEllipticalPlane(p0, vx, vz, 100, 200, 10);
makeEllipticalPlane(p0, vx, 100, 200, 10);
makeBend2(p0, vx, vz, sides4, false, 90, 0, 400, 400, 400, 10, 600, 600);
makeSymbolicLine(p0, p1);
makeGrillType1(p0, vx, 100, 200, 30, 5, 2, 1);
makeVascoStraight(p0, vx, vz, sides4, sides4, 100, 2);
addThinLine(p0, p1);
drawAsThinLine(p0, p1);
setHlrSplineType(1);
calcTR3(1, 2, 3, 4, 5, 6, 7);
ads_point a = {0, 0, 0};
ads_point b = {10, 0, 0};
make_line(a, b);
make_circle(a, 25);
printLog(1, 2);
makeImaginaryWidget(p0, 10);
drawNothingAtAll(p0);
