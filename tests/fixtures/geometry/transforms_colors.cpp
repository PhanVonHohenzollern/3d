// preTransformMesh/postTransformMesh (translation and rotation; pre multiplies
// on the left, post on the right), setPrimitiveMode (ignored), setMeshColor
// (RGB, ACAD index including 0, non-numeric and unsupported overloads).
//@line 14
//@line 23
//@line 45
//@line 58
FdPoint3d p0(0, 0, 0);
FdPoint3d p1(100, 0, 0);
makeVerySimpleTube(p0, p1, 20, 1);
preTransformMesh(vz * 50);
makeVerySimpleTube(p0, p1, 20, 1);
preTransformMesh(M_PI / 2, vz);
makeVerySimpleTube(p0, p1, 20, 1);
postTransformMesh(vx * 10);
makeFlatDisc(p0, vx, 40, 2);
postTransformMesh(0.3, FdVector3d(1, 1, 1));
setPrimitiveMode(pmNormal);
FdVector3d boxVecs[2] = {vx, vx};
FdPoint3d boxPts[2] = {p0, p1};
makeBox(1, boxPts, boxVecs, 30, 20);
preTransformMesh(-0.3, FdVector3d(1, 1, 1));
makeRectFace(p0, vz, vy, 10, 20);
// Invalid transforms warn and keep the current matrix.
preTransformMesh(vz * 0 + vx, 3);
postTransformMesh(1.0, vz * 0);
preTransformMesh(p0);
postTransformMesh(1, 2, 3);
preTransformMesh(missingTranslation);
makeSimpleTube(p0, p1, 30, 10, 1);
// Colors: the default is golden orange until setMeshColor changes it.
setMeshColor(255, 0, 128);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(0);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(3);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(7.4);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(128);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(-20);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(900);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(300.5, -10, 12.75);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(true, false, true);
makeFlatDisc(p0, vz, 40, 1);
setMeshColor(p0, 1, 2);
setMeshColor(p0);
setMeshColor(1, 2);
setMeshColor(missingColor);
makeFlatDisc(p0, vz, 40, 1);
for (int i = 1; i <= 7; i++) {
    setMeshColor(i);
    makeFlatDisc(p0 + vx * (50.0 * i), vz, 40, 1);
}
