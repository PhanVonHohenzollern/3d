//@eval 2*cpx
//@eval W*0.5
//@eval missingName
//@connector Circular|XPositive|100|||0,0,0|0,0,0
//@connector Rectangular|ZNegative||W|0.5*W|10,20,30|0,45,0|conn|linkPointA
//@param Width=250
//@line 12
//@line 20
FdPoint3d p0(0, 0, 0);
double W = 200;
get_val("Width", W);
FdVector3d n = vx;
FdPoint3d pts[2] = {p0, p0 + n * 500};
setMeshColor(1);
makeBox(1, pts, n, W, 100, true);
makeSimpleTube(pts[1], pts[1] + vz * 300, 80, 60, cpx);
for (int i = 0; i < 2; i++) {
    FdPoint3d c = p0 + vy * (100.0 * i);
    makeSimpleTube(c, c + vx * 50, 20, 20, 3);
}
