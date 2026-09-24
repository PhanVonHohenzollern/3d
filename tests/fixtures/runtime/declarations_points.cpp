// FdPoint3d / FdVector3d declarations and constructors.
//@line 999
//@line 9
//@eval p1.x
//@eval v3
FdPoint3d p0;
FdPoint3d p1(1, 2, 3);
FdPoint3d p2 = FdPoint3d(4, 5, 6);
FdPoint3d p3(p1);
FdPoint3d p4 = p1;
FdPoint3d p5 = FdPoint3d();
FdPoint3d p6 = FdPoint3d::kOrigin;
FdVector3d v0;
FdVector3d v1(1, 0, 0);
FdVector3d v2 = FdVector3d(0.5, -1, 2);
FdVector3d v3 = FdVector3d::kXAxis + FdVector3d::kYAxis * 2 + FdVector3d::kZAxis * 3;
FdVector3d v4 = FdVector3d::kIdentity;
FdVector3d v5 = p2 - p1;
FdPoint3d p7 = p1 + v2;
FdPoint3d p8 = v2 + p1;
FdPoint3d p9 = p1 - v1;
FdVector3d v6 = -v2;
FdVector3d v7(v1 * 3);
FdPoint3d bad1(1, 2);
FdPoint3d bad2 = {1, 2, 3};
FdPoint3d bad3 = v1;
FdVector3d bad4(p1);
FdPoint3d bad5 = FdPoint3d(1, 2);
FdVector3d bad6 = FdVector3d(p1);
FdPoint3d bad7 = -p1;
FdVector3d bad8 = FdVector3d::kFoo;
FdPoint3d p10 = FdPoint3d(v1.x, v2.y, 7);
double comp = FdVector3d::kXAxis.x;
