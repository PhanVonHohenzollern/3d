// makeRectFace and the three makePlane overloads (points[4] with default
// draw=true, p1..p4, cp/normal/upVector/H/L), plus rejected inputs.
FdPoint3d c(10, 20, 30);
FdPoint3d quad[4] = {FdPoint3d(0, 0, 0), FdPoint3d(100, 0, 0), FdPoint3d(100, 50, 20), FdPoint3d(0, 50, 20)};
FdPoint3d collinear[4] = {FdPoint3d(0, 0, 0), FdPoint3d(1, 0, 0), FdPoint3d(2, 0, 0), FdPoint3d(3, 0, 0)};
FdPoint3d five[5] = {FdPoint3d(0, 0, 0), FdPoint3d(0, 100, 0), FdPoint3d(0, 100, 100), FdPoint3d(0, 0, 100), FdPoint3d(5, 5, 5)};
FdPoint3d three[3] = {FdPoint3d(0, 0, 0), FdPoint3d(1, 0, 0), FdPoint3d(1, 1, 0)};
makeRectFace(c, vz, vy, 40, 80);
makeRectFace(c, FdVector3d(1, 1, 0), vz, 25.5, 12.25);
makeRectFace(c, vx, vx, 10, 20);
makeRectFace(c, vz, FdVector3d(1, 1, 5), 10, 20);
makePlane(quad);
makePlane(quad, false);
makePlane(collinear);
makePlane(five, true);
makePlane(quad[0], quad[1], quad[2], quad[3]);
makePlane(quad[3], quad[2], quad[1], quad[0]);
makePlane(c, vy, vz, 60, 30);
makePlane(c, FdVector3d(2, 0, 1), vy, 5, 7.5);
// Rejected makeRect/makePlane inputs: warnings, no mesh.
makeRectFace(c, vz * 0, vy, 40, 80);
makeRectFace(c, vz, vy * 0, 40, 80);
makeRectFace(c, vz, vy, 0, 80);
makeRectFace(c, vz, vy, 40, -80);
makeRectFace(c, vz, vy, missingH, 80);
makePlane(three);
makePlane(c, vy, vz, 0, 30);
makePlane(c, vy * 0, vz, 60, 30);
makePlane(quad[0], quad[1], quad[2], missingPoint);
