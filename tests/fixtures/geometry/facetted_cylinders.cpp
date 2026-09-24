// makeFacettedCylinder (front/back defaults from metadata, closed and partial
// sweeps, fractional complexity) and makeScrew (6 and 7 arguments).
FdPoint3d a(0, 0, 0);
FdPoint3d b(0, 0, 500);
FdVector3d up = vx;
makeFacettedCylinder(a, b, up, 200, 0, 360, 8);
makeFacettedCylinder(a, b, vy, 150, 0, 360, 8, true, true);
makeFacettedCylinder(a, FdPoint3d(300, 100, 50), vz, 90, 30, 120, 12, true, false);
makeFacettedCylinder(a, b, up, 80, 90, 90, 5.5, false, true);
makeFacettedCylinder(a, b, up, 80, 180, 0, 7, 1, 0);
makeFacettedCylinder(a, b, vz, 60, -45, 45, 2);
makeFacettedCylinder(a, b, up, 60, 0, 10, 1, true, true);
makeFacettedCylinder(a, b, up, 60, 0, 720, 3000);
// Invalid facetted-cylinder inputs.
makeFacettedCylinder(a, b, up, 0, 0, 360, 8);
makeFacettedCylinder(a, b, up, 50, 0, 360, 0.4);
makeFacettedCylinder(a, a, up, 50, 0, 360, 8);
makeFacettedCylinder(a, b, a, 50, 0, 360, 8);
makeFacettedCylinder(a, b, up, 50, 0, 360, missingI);
// makeScrew: cp, vector, upVector, d1, length, back[, front=true].
makeScrew(a, vx, vz, 20, 100, false);
makeScrew(b, FdVector3d(0, 3, 4), vx, 12.5, -80, true, false);
makeScrew(a, vy, vy, 16, 40, 1, 1);
makeScrew(a, vx * 0, vz, 20, 100, false);
makeScrew(a, vx, vz, 0, 100, false);
makeScrew(a, vx, vz, 20, 0, false);
makeScrew(a, vx, vz, 20, 100, missingBack);
