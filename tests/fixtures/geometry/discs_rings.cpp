// makeFlatDisc, makeFlatRing (either diameter order), makeDisc (thickness,
// segment flag) and makeSymbolicCircle, including invalid inputs.
FdPoint3d c(100, -50, 25);
FdVector3d tilted(1, 2, 3);
makeFlatDisc(c, vz, 200, 2);
makeFlatDisc(c, tilted, 75.5, 3);
makeFlatDisc(c, vx * -1, 40, 1);
makeFlatRing(c, vy, 100, 160, 3);
makeFlatRing(c, tilted, 160, 100, 2);
makeFlatRing(c, vz, 0, 50, 1);
makeDisc(c, vx, 120, 10, 3, true);
makeDisc(c, tilted, 90, 0, 2, false);
makeDisc(c, vz * -2, 50, 25.5, 1, 1);
makeSymbolicCircle(c, vz, 300);
makeSymbolicCircle(c, tilted, 1);
makeSymbolicCircle(c, vy, 0.5);
// Invalid dimensions/normals: warnings only.
makeFlatDisc(c, vz * 0, 100, 2);
makeFlatDisc(c, vz, 0, 2);
makeFlatDisc(c, vz, 100, 0);
makeFlatDisc(c, missingNormal, 100, 2);
makeFlatRing(c, vz, 100, 100, 2);
makeFlatRing(c, vz, -10, 100, 2);
makeFlatRing(c, FdVector3d(0, 0, 0), 10, 100, 2);
makeFlatRing(c, vz, 10, 100, 0);
makeFlatRing(missingCenter, vz, 10, 100, 2);
makeDisc(c, vz, 100, -1, 2, true);
makeDisc(c, vz, 0, 5, 2, true);
makeDisc(c, vz, 100, 5, 0, true);
makeDisc(c, FdVector3d(1e-12, 0, 0), 100, 5, 2, true);
makeDisc(c, vz, 100, 5, 2, missingFlag);
makeSymbolicCircle(c, vz, 0);
makeSymbolicCircle(c, vz * 0, 10);
makeSymbolicCircle(c, vz, missingDiameter);
