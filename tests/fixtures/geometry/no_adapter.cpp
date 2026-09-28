// Registry APIs without a preview adapter: the GeoCache3dInt.h erase helpers
// warn and draw nothing; non-drawing calls (setHlrSplineType, calc*, printLog)
// are traced silently; invented make* names are rejected by the runtime.
// Every API here must stay out of the adapter registry (see geometry.test.ts).
FdPoint3d p0(0, 0, 0);
FdPoint3d p1(100, 0, 0);
bool sides4[4] = {true, true, true, true};
addEraseLine(p0, p1);
addEraseLine(p0, p1, vz);
addEraseCircle(p0, vz, 50);
addEraseRect(p0, vz, vx, 20, 40, sides4);
addEraseRegion(p0, p1, FdPoint3d(0, 100, 0));
setHlrSplineType(1);
calcTR3(1, 2, 3, 4, 5, 6, 7);
printLog(1, 2);
makeImaginaryWidget(p0, 10);
drawNothingAtAll(p0);
